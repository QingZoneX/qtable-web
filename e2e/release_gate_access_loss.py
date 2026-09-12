from __future__ import annotations

from release_gate_support import fail, gql_data, graphql
from webdriver_client import Browser, wait_for


def _start_table_subscription(browser: Browser, table_id: str, key: str) -> None:
    query = """subscription ReleaseRevokedTableUpdates($tableId: String, $includeSnapshot: Boolean!) {
      tableUpdates(tableId: $tableId, includeSnapshot: $includeSnapshot)
    }"""
    browser.evaluate(
        """
        const query = arguments[0];
        const tableId = arguments[1];
        const key = arguments[2];
        window[key] = {acked: false, events: [], errors: [], closed: false};
        const token = localStorage.getItem('qtable_token');
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${location.host}/ws`, 'graphql-transport-ws');
        window[key].socket = ws;
        ws.onopen = () => ws.send(JSON.stringify({
          type: 'connection_init',
          payload: {Authorization: `Bearer ${token}`},
        }));
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connection_ack') {
            window[key].acked = true;
            ws.send(JSON.stringify({
              id: key,
              type: 'subscribe',
              payload: {query, variables: {tableId, includeSnapshot: false}},
            }));
          } else if (msg.type === 'next') {
            window[key].events.push(msg.payload);
          } else if (msg.type === 'error') {
            window[key].errors.push(msg.payload);
          } else if (msg.type === 'complete') {
            window[key].closed = true;
          }
        };
        ws.onclose = () => { window[key].closed = true; };
        """,
        [query, table_id, key],
    )
    wait_for(
        lambda: bool(browser.evaluate("return window[arguments[0]]?.acked", [key])),
        timeout=15,
        label="workspace-loss subscription ack",
    )


def _stop_table_subscription(browser: Browser, key: str) -> None:
    browser.evaluate(
        "if (window[arguments[0]]?.socket) window[arguments[0]].socket.close()",
        [key],
    )


def _notification(browser: Browser, notification_id: str) -> dict:
    payload = gql_data(
        browser,
        """query ReleaseWorkspaceLossNotifications($limit: Int!, $unreadOnly: Boolean!, $timezone: String!) {
          notifications(limit: $limit, unreadOnly: $unreadOnly, timezone: $timezone)
        }""",
        {"limit": 50, "unreadOnly": False, "timezone": "UTC"},
    )["notifications"]
    item = next(
        (
            entry
            for entry in (payload.get("items") or [])
            if str(entry.get("id") or "") == notification_id
        ),
        None,
    )
    if not item:
        fail("workspace-loss notification disappeared instead of being permission-redacted", payload)
    return item


def assert_workspace_access_loss(
    alice: Browser,
    bob: Browser,
    *,
    workspace_id: str,
    table_id: str,
    record_id: str,
    bob_email: str,
    bob_user_id: int,
    notification_id: str,
) -> None:
    key = "__releaseWorkspaceLossRealtime"
    _start_table_subscription(bob, table_id, key)
    baseline = int(
        bob.evaluate("return window[arguments[0]]?.events.length || 0", [key]) or 0
    )

    left = gql_data(
        bob,
        "mutation ReleaseLeaveWorkspace($workspaceId: ID!) { leaveWorkspace(workspaceId: $workspaceId) }",
        {"workspaceId": workspace_id},
    )["leaveWorkspace"]
    if left is not True:
        fail("viewer could not leave workspace during access-loss gate", left)

    denied = graphql(
        bob,
        "query ReleaseWorkspaceRevokedRecord($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
        allow_errors=True,
    )
    if not denied.get("errors"):
        fail("record remained readable after workspace membership loss", denied)

    tombstone = _notification(bob, notification_id)
    if (
        tombstone.get("accessible") is not False
        or tombstone.get("deepLink") is not None
        or tombstone.get("payload")
    ):
        fail("workspace-revoked notification leaked private content", tombstone)

    gql_data(
        alice,
        """mutation ReleaseWriteAfterWorkspaceRevoke($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) {
          updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId)
        }""",
        {
            "recordId": record_id,
            "fieldId": "release_status",
            "value": "workspace-revoked-update",
            "tableId": table_id,
        },
    )
    wait_for(
        lambda: bool(
            bob.evaluate(
                "return Boolean(window[arguments[0]]?.closed || window[arguments[0]]?.errors.length)",
                [key],
            )
        ),
        timeout=15,
        label="revoked realtime stream termination",
    )
    after = int(
        bob.evaluate("return window[arguments[0]]?.events.length || 0", [key]) or 0
    )
    if after != baseline:
        fail(
            "workspace-revoked realtime subscription received a private table event",
            {"before": baseline, "after": after},
        )
    _stop_table_subscription(bob, key)

    restored = gql_data(
        alice,
        """mutation ReleaseReinvite($email: String!, $workspaceId: ID!, $role: String!) {
          inviteUserToWorkspace(email: $email, workspaceId: $workspaceId, role: $role) { userId email role }
        }""",
        {"email": bob_email, "workspaceId": workspace_id, "role": "viewer"},
    )["inviteUserToWorkspace"]
    if int(restored.get("userId") or 0) != int(bob_user_id):
        fail("workspace re-invite resolved to an unexpected user", restored)

    visible = gql_data(
        bob,
        "query ReleaseWorkspaceRestoredRecord($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )["recordById"]
    if not visible:
        fail("record access did not recover after workspace re-invite")

    restored_notification = _notification(bob, notification_id)
    if restored_notification.get("accessible") is not True or not restored_notification.get("deepLink"):
        fail("notification did not recover after workspace permission restoration", restored_notification)
