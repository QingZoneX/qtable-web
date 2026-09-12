from __future__ import annotations

import time

from webdriver_client import Browser, wait_for
from release_gate_support import fail, gql_data, graphql


def create_table_fixture(browser: Browser, workspace_id: str, root_id: str) -> dict[str, str]:
    created = gql_data(
        browser,
        """mutation ReleaseCreateTable($name: String!, $parentId: String!, $workspaceId: String) {
          createTable(name: $name, parentId: $parentId, workspaceId: $workspaceId)
        }""",
        {"name": "Release E2E Table", "parentId": root_id, "workspaceId": workspace_id},
    )["createTable"]
    table_id = str(created.get("id") or created.get("tableId") or "")
    view_id = str(created.get("defaultViewId") or created.get("viewId") or "")
    if not table_id:
        fail("createTable did not return table id", created)

    for field in (
        {"id": "release_title", "name": "Release title", "type": "text"},
        {"id": "release_status", "name": "Release status", "type": "text"},
        {"id": "release_owner", "name": "Release owner", "type": "member"},
        {"id": "release_temp", "name": "Temporary", "type": "text"},
    ):
        gql_data(
            browser,
            "mutation ReleaseAddField($field: JSON!, $tableId: String) { addField(field: $field, tableId: $tableId) }",
            {"field": field, "tableId": table_id},
        )
    gql_data(
        browser,
        "mutation ReleaseUpdateField($fieldId: String!, $updates: JSON!, $tableId: String) { updateField(fieldId: $fieldId, updates: $updates, tableId: $tableId) }",
        {"fieldId": "release_status", "updates": {"name": "Release state"}, "tableId": table_id},
    )
    gql_data(
        browser,
        "mutation ReleaseDeleteField($fieldId: String!, $tableId: String) { deleteField(fieldId: $fieldId, tableId: $tableId) }",
        {"fieldId": "release_temp", "tableId": table_id},
    )
    record = gql_data(
        browser,
        "mutation ReleaseInsert($tableId: String, $data: JSON) { insertRow(tableId: $tableId, data: $data) }",
        {"tableId": table_id, "data": {"release_title": "alpha-seed", "release_status": "draft"}},
    )["insertRow"]
    record_id = str(record.get("id") or "")
    if not record_id:
        fail("insertRow did not return record id", record)
    gql_data(
        browser,
        """mutation ReleaseUpdate($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) {
          updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId)
        }""",
        {"recordId": record_id, "fieldId": "release_status", "value": "ready", "tableId": table_id},
    )
    snapshot = gql_data(
        browser,
        "query ReleaseTableData($tableId: String) { fields(tableId: $tableId) views(tableId: $tableId) }",
        {"tableId": table_id},
    )
    field_ids = {str(item.get("id")) for item in snapshot["fields"]}
    if "release_temp" in field_ids or not {"release_title", "release_status", "release_owner"} <= field_ids:
        fail("field create/edit/delete contract failed", snapshot["fields"])
    if not view_id and snapshot.get("views"):
        view_id = str(snapshot["views"][0].get("id") or "")
    return {"table_id": table_id, "view_id": view_id, "record_id": record_id}


def assert_record_persistence(browser: Browser, table_id: str, view_id: str, record_id: str) -> None:
    record = gql_data(
        browser,
        "query ReleaseRecord($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )["recordById"]
    if record.get("release_status") != "ready":
        fail("updated record did not persist", record)
    page = gql_data(
        browser,
        """query ReleaseRows($tableId: String, $filters: [JSON!], $sorts: [JSON!], $offset: Int!, $limit: Int!) {
          queryRecords(tableId: $tableId, filters: $filters, sorts: $sorts, offset: $offset, limit: $limit)
        }""",
        {
            "tableId": table_id,
            "filters": [{"fieldId": "release_status", "operator": "equals", "value": "ready"}],
            "sorts": [{"fieldId": "release_title", "direction": "asc"}],
            "offset": 0,
            "limit": 20,
        },
    )["queryRecords"]
    if not any(str(item.get("id")) == record_id for item in (page.get("records") or [])):
        fail("filtered/sorted server query did not include record", page)
    path = f"/workbench/{table_id}" + (f"/{view_id}" if view_id else "")
    browser.navigate(path)
    wait_for(lambda: bool(browser.find_all("canvas")), timeout=30, label="table canvas")
    browser.refresh()
    wait_for(lambda: bool(browser.find_all("canvas")), timeout=30, label="table hard refresh")
    browser.navigate(f"{path}?recordId={record_id}")
    wait_for(lambda: bool(browser.find_all("canvas")), timeout=30, label="record deep link")


def invite_viewer(alice: Browser, workspace_id: str, email: str) -> int:
    result = gql_data(
        alice,
        """mutation ReleaseInvite($email: String!, $workspaceId: ID!, $role: String!) {
          inviteUserToWorkspace(email: $email, workspaceId: $workspaceId, role: $role) { userId email role }
        }""",
        {"email": email, "workspaceId": workspace_id, "role": "viewer"},
    )["inviteUserToWorkspace"]
    return int(result["userId"])


def assert_unshared_denied(browser: Browser, table_id: str, record_id: str) -> None:
    body = graphql(
        browser,
        "query ReleaseDenied($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
        allow_errors=True,
    )
    if not body.get("errors") and body.get("data", {}).get("recordById") is not None:
        fail("unshared user could read record", body)


def grant_table_read(alice: Browser, *, workspace_id: str, table_id: str, user_id: int) -> None:
    gql_data(
        alice,
        """mutation ReleaseTablePermission($itemId: String!, $userId: Int!, $permission: String!, $workspaceId: String) {
          setItemPermission(itemId: $itemId, userId: $userId, permission: $permission, workspaceId: $workspaceId)
        }""",
        {"itemId": table_id, "userId": user_id, "permission": "read", "workspaceId": workspace_id},
    )


def _start_subscription(browser: Browser, table_id: str, key: str) -> None:
    query = """subscription ReleaseTableUpdates($tableId: String, $includeSnapshot: Boolean!) {
      tableUpdates(tableId: $tableId, includeSnapshot: $includeSnapshot)
    }"""
    browser.evaluate(
        """
        const key = arguments[2];
        window[key] = {events: [], errors: []};
        const token = localStorage.getItem('qtable_token');
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${location.host}/ws`, 'graphql-transport-ws');
        window[key].socket = ws;
        ws.onopen = () => ws.send(JSON.stringify({type:'connection_init', payload:{Authorization:`Bearer ${token}`}}));
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connection_ack') {
            ws.send(JSON.stringify({id:key, type:'subscribe', payload:{query:arguments[0], variables:{tableId:arguments[1], includeSnapshot:false}}}));
          } else if (msg.type === 'next') {
            window[key].events.push(msg.payload);
          } else if (msg.type === 'error') {
            window[key].errors.push(msg.payload);
          }
        };
        """,
        [query, table_id, key],
    )


def _stop_subscription(browser: Browser, key: str) -> None:
    browser.evaluate("if (window[arguments[0]]?.socket) window[arguments[0]].socket.close()", [key])


def assert_realtime(alice: Browser, bob: Browser, table_id: str, record_id: str) -> None:
    key = "__releaseRealtime"
    _start_subscription(bob, table_id, key)
    time.sleep(1)
    gql_data(
        alice,
        """mutation ReleaseRealtimeUpdate($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) {
          updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId)
        }""",
        {"recordId": record_id, "fieldId": "release_status", "value": "realtime-ok", "tableId": table_id},
    )
    wait_for(
        lambda: int(bob.evaluate("return (window[arguments[0]]?.events.length || 0)", [key])) > 0,
        timeout=20,
        label="tableUpdates event",
    )
    _stop_subscription(bob, key)
    recovered = gql_data(
        bob,
        "query ReleaseRecover($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )["recordById"]
    if recovered.get("release_status") != "realtime-ok":
        fail("reconnect/recovery server read is stale", recovered)


def assert_row_permission(
    alice: Browser,
    bob: Browser,
    *,
    workspace_id: str,
    table_id: str,
    record_id: str,
    alice_email: str,
) -> None:
    members = gql_data(
        alice,
        "query ReleaseMembers($workspaceId: ID!) { workspaceMembers(workspaceId: $workspaceId) { userId email role } }",
        {"workspaceId": workspace_id},
    )["workspaceMembers"]
    owner = next((item for item in members if str(item.get("email")).lower() == alice_email.lower()), None)
    if not owner:
        fail("workspace owner missing from members", members)
    gql_data(
        alice,
        """mutation ReleaseOwnerCell($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) {
          updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId)
        }""",
        {"recordId": record_id, "fieldId": "release_owner", "value": [int(owner["userId"])], "tableId": table_id},
    )
    policy = gql_data(
        alice,
        """mutation ReleaseRowPolicy($tableId: String!, $mode: String!, $memberFieldId: String) {
          updateRowPermissionPolicy(tableId: $tableId, mode: $mode, memberFieldId: $memberFieldId)
        }""",
        {"tableId": table_id, "mode": "member_field", "memberFieldId": "release_owner"},
    )["updateRowPermissionPolicy"]
    if policy.get("mode") != "member_field":
        fail("row permission policy not enabled", policy)
    denied = graphql(
        bob,
        "query ReleaseRowHidden($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
        allow_errors=True,
    )
    if not denied.get("errors"):
        fail("row-hidden record was reachable by deep link", denied)
    page = gql_data(
        bob,
        "query ReleaseRowHiddenGrid($tableId: String, $offset: Int!, $limit: Int!) { queryRecords(tableId: $tableId, offset: $offset, limit: $limit) }",
        {"tableId": table_id, "offset": 0, "limit": 20},
    )["queryRecords"]
    if any(str(item.get("id")) == record_id for item in (page.get("records") or [])):
        fail("row-hidden record was reachable by grid query", page)
    gql_data(
        alice,
        """mutation ReleaseRowPolicyReset($tableId: String!, $mode: String!, $memberFieldId: String) {
          updateRowPermissionPolicy(tableId: $tableId, mode: $mode, memberFieldId: $memberFieldId)
        }""",
        {"tableId": table_id, "mode": "all", "memberFieldId": None},
    )
    if not gql_data(
        bob,
        "query ReleaseVisibleAgain($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )["recordById"]:
        fail("row did not become readable after permission reset")


def assert_failed_write_no_false_success(alice: Browser, bob: Browser, table_id: str, record_id: str) -> None:
    denied = graphql(
        bob,
        """mutation ReleaseDeniedWrite($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) {
          updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId)
        }""",
        {"recordId": record_id, "fieldId": "release_status", "value": "forbidden-write", "tableId": table_id},
        allow_errors=True,
    )
    if not denied.get("errors"):
        fail("viewer write unexpectedly succeeded", denied)
    stored = gql_data(
        alice,
        "query ReleaseNoFalseSuccess($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )["recordById"]
    if stored.get("release_status") == "forbidden-write":
        fail("failed write changed server state")
