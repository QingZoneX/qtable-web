from __future__ import annotations

from webdriver_client import Browser, wait_for
from release_gate_support import ASYNC_GRAPHQL, body_text, fail, gql_data, graphql


def assert_collaboration(
    alice: Browser,
    bob: Browser,
    *,
    table_id: str,
    record_id: str,
    bob_user_id: int,
) -> str:
    comment = gql_data(
        alice,
        """mutation ReleaseComment($tableId: String!, $recordId: ID!, $body: String!, $mentionUserIds: [Int!]) {
          createRecordComment(tableId: $tableId, recordId: $recordId, body: $body, mentionUserIds: $mentionUserIds)
        }""",
        {
            "tableId": table_id,
            "recordId": record_id,
            "body": "Release E2E mention path",
            "mentionUserIds": [bob_user_id],
        },
    )["createRecordComment"]
    comment_id = str(comment.get("id") or "")
    if not comment_id:
        fail("comment id missing", comment)

    comments = gql_data(
        alice,
        """query ReleaseComments($tableId: String!, $recordId: ID!, $limit: Int!) {
          recordComments(tableId: $tableId, recordId: $recordId, limit: $limit)
        }""",
        {"tableId": table_id, "recordId": record_id, "limit": 20},
    )["recordComments"]
    if not any(str(item.get("id")) == comment_id for item in (comments.get("items") or [])):
        fail("created comment missing from record workspace", comments)

    activity = gql_data(
        alice,
        """query ReleaseActivity($tableId: String!, $recordId: ID!, $limit: Int!) {
          recordActivity(tableId: $tableId, recordId: $recordId, limit: $limit)
        }""",
        {"tableId": table_id, "recordId": record_id, "limit": 20},
    )["recordActivity"]
    if not (activity.get("items") or []):
        fail("record activity is empty after collaboration mutation", activity)

    notifications = gql_data(
        bob,
        """query ReleaseNotifications($limit: Int!, $unreadOnly: Boolean!, $timezone: String!) {
          notifications(limit: $limit, unreadOnly: $unreadOnly, timezone: $timezone)
        }""",
        {"limit": 30, "unreadOnly": False, "timezone": "UTC"},
    )["notifications"]
    mention = next(
        (
            item
            for item in (notifications.get("items") or [])
            if item.get("type") == "comment_mention"
            and str(item.get("commentId") or "") == comment_id
        ),
        None,
    )
    if not mention:
        fail("mention notification missing", notifications)
    if mention.get("accessible") is not True or not mention.get("deepLink"):
        fail("accessible mention did not provide a real deep link", mention)
    bob.navigate(str(mention["deepLink"]))
    wait_for(lambda: bool(bob.find_all("canvas")), timeout=30, label="notification deep link")
    return str(mention["id"])


def assert_notification_redaction(
    alice: Browser,
    bob: Browser,
    *,
    table_id: str,
    notification_id: str,
) -> None:
    policy = gql_data(
        alice,
        """mutation ReleaseHideForNotification($tableId: String!, $mode: String!, $memberFieldId: String) {
          updateRowPermissionPolicy(tableId: $tableId, mode: $mode, memberFieldId: $memberFieldId)
        }""",
        {"tableId": table_id, "mode": "member_field", "memberFieldId": "release_owner"},
    )["updateRowPermissionPolicy"]
    if policy.get("mode") != "member_field":
        fail("row permission did not enable for notification redaction", policy)
    notifications = gql_data(
        bob,
        """query ReleaseRedactedNotifications($limit: Int!, $unreadOnly: Boolean!, $timezone: String!) {
          notifications(limit: $limit, unreadOnly: $unreadOnly, timezone: $timezone)
        }""",
        {"limit": 30, "unreadOnly": False, "timezone": "UTC"},
    )["notifications"]
    item = next(
        (entry for entry in (notifications.get("items") or []) if str(entry.get("id")) == notification_id),
        None,
    )
    if not item:
        fail("existing notification disappeared instead of becoming a safe tombstone", notifications)
    if item.get("accessible") is not False or item.get("deepLink") is not None or item.get("payload"):
        fail("permission-hidden notification leaked private content", item)
    gql_data(
        alice,
        """mutation ReleaseUnhideForNotification($tableId: String!, $mode: String!, $memberFieldId: String) {
          updateRowPermissionPolicy(tableId: $tableId, mode: $mode, memberFieldId: $memberFieldId)
        }""",
        {"tableId": table_id, "mode": "all", "memberFieldId": None},
    )


def assert_automation(browser: Browser, *, table_id: str, record_id: str) -> None:
    trigger = {"type": "record.updated", "fieldIds": ["release_title"]}
    conditions = {"op": "and", "items": []}
    actions = [{"type": "update_record", "fields": {"release_status": "automated"}}]
    validated = gql_data(
        browser,
        """mutation ReleaseValidateAutomation($tableId: ID!, $trigger: JSON!, $conditions: JSON!, $actions: JSON!, $timezone: String!, $maxRetries: Int!) {
          validateAutomation(tableId: $tableId, trigger: $trigger, conditions: $conditions, actions: $actions, timezone: $timezone, maxRetries: $maxRetries)
        }""",
        {
            "tableId": table_id,
            "trigger": trigger,
            "conditions": conditions,
            "actions": actions,
            "timezone": "UTC",
            "maxRetries": 1,
        },
    )["validateAutomation"]
    if not validated.get("valid"):
        fail("automation definition rejected", validated)
    created = gql_data(
        browser,
        """mutation ReleaseCreateAutomation($tableId: ID!, $name: String!, $trigger: JSON!, $conditions: JSON!, $actions: JSON!, $timezone: String!, $maxRetries: Int!, $enabled: Boolean!) {
          createAutomation(tableId: $tableId, name: $name, trigger: $trigger, conditions: $conditions, actions: $actions, timezone: $timezone, maxRetries: $maxRetries, enabled: $enabled)
        }""",
        {
            "tableId": table_id,
            "name": "Release E2E Automation",
            "trigger": trigger,
            "conditions": conditions,
            "actions": actions,
            "timezone": "UTC",
            "maxRetries": 1,
            "enabled": False,
        },
    )["createAutomation"]
    automation_id = str(created.get("id") or created.get("automationId") or "")
    if not automation_id:
        fail("automation id missing", created)
    enabled = gql_data(
        browser,
        "mutation ReleaseEnableAutomation($automationId: ID!, $enabled: Boolean!) { setAutomationEnabled(automationId: $automationId, enabled: $enabled) }",
        {"automationId": automation_id, "enabled": True},
    )["setAutomationEnabled"]
    if enabled.get("enabled") is not True:
        fail("automation did not enable", enabled)
    execution = gql_data(
        browser,
        "mutation ReleaseRunAutomation($automationId: ID!, $recordId: ID) { runAutomation(automationId: $automationId, recordId: $recordId) }",
        {"automationId": automation_id, "recordId": record_id},
    )["runAutomation"]
    if not execution:
        fail("manual automation returned no execution")
    history = gql_data(
        browser,
        """query ReleaseAutomationHistory($automationId: ID!, $offset: Int!, $limit: Int!) {
          automationExecutions(automationId: $automationId, offset: $offset, limit: $limit)
        }""",
        {"automationId": automation_id, "offset": 0, "limit": 20},
    )["automationExecutions"]
    items = history.get("items") if isinstance(history, dict) else history
    if not items:
        fail("automation execution history is empty", history)


def assert_dashboard_data(
    browser: Browser,
    *,
    workspace_id: str,
    root_id: str,
    table_id: str,
) -> str:
    dashboard = gql_data(
        browser,
        """mutation ReleaseDashboard($name: String!, $parentId: String!, $workspaceId: String) {
          createDashboard(name: $name, parentId: $parentId, workspaceId: $workspaceId)
        }""",
        {"name": "Release E2E Dashboard", "parentId": root_id, "workspaceId": workspace_id},
    )["createDashboard"]
    dashboard_id = str(dashboard.get("id") or dashboard.get("dashboardId") or "")
    if not dashboard_id:
        fail("dashboard id missing", dashboard)
    widget = gql_data(
        browser,
        """mutation ReleaseDashboardWidget($dashboardId: String!, $widget: JSON!) {
          createDashboardWidget(dashboardId: $dashboardId, widget: $widget)
        }""",
        {
            "dashboardId": dashboard_id,
            "widget": {
                "type": "metric",
                "title": "Release row count",
                "layout": {"x": 0, "y": 0, "w": 6, "h": 8},
                "config": {
                    "tableId": table_id,
                    "metric": {"aggregation": "count", "fieldId": None},
                    "filters": [],
                    "sort": {"by": "value", "order": "desc"},
                    "limit": 50,
                },
            },
        },
    )["createDashboardWidget"]
    widget_id = str(widget.get("id") or "")
    if not widget_id:
        fail("dashboard widget id missing", widget)
    payload = gql_data(
        browser,
        "query ReleaseDashboardData($widgetId: String!, $dashboardId: String) { dashboardWidgetData(widgetId: $widgetId, dashboardId: $dashboardId) }",
        {"widgetId": widget_id, "dashboardId": dashboard_id},
    )["dashboardWidgetData"]
    metric = payload.get("metric") if isinstance(payload, dict) else None
    if not isinstance(metric, dict) or metric.get("value") is None:
        fail("dashboard widget did not return real metric data", payload)
    browser.navigate(f"/workbench/{dashboard_id}")
    wait_for(lambda: dashboard_id in browser.current_url(), timeout=20, label="dashboard workbench")
    return dashboard_id


def assert_recycle_lifecycle(alice: Browser, bob: Browser, *, table_id: str, record_id: str) -> None:
    denied = graphql(
        bob,
        "query ReleaseDeniedRecycle($tableId: String!, $offset: Int!, $limit: Int!) { recycleBin(tableId: $tableId, offset: $offset, limit: $limit) }",
        {"tableId": table_id, "offset": 0, "limit": 20},
        allow_errors=True,
    )
    if not denied.get("errors"):
        fail("viewer could manage/read recycle bin", denied)
    gql_data(
        alice,
        "mutation ReleaseDeleteRecord($recordId: ID!, $tableId: String) { deleteRecord(recordId: $recordId, tableId: $tableId) }",
        {"recordId": record_id, "tableId": table_id},
    )
    recycle = gql_data(
        alice,
        "query ReleaseRecycle($tableId: String!, $offset: Int!, $limit: Int!) { recycleBin(tableId: $tableId, offset: $offset, limit: $limit) }",
        {"tableId": table_id, "offset": 0, "limit": 20},
    )["recycleBin"]
    if not any(str(item.get("recordId")) == record_id for item in (recycle.get("items") or [])):
        fail("deleted record missing from recycle bin", recycle)
    alice.navigate("/recycle-bin")
    wait_for(lambda: "回收站" in body_text(alice), timeout=20, label="recycle bin UI")
    gql_data(
        alice,
        "mutation ReleaseRestoreRecord($tableId: String!, $recordId: ID!) { restoreRecord(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )
    restored = gql_data(
        alice,
        "query ReleaseRestoredRecord($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
    )["recordById"]
    if not restored:
        fail("restore did not recover record")
    alice.navigate(f"/workbench/{table_id}?recordId={record_id}")
    wait_for(lambda: bool(alice.find_all("canvas")), timeout=30, label="restore-and-open")
    gql_data(
        alice,
        "mutation ReleaseDeleteRecordAgain($recordId: ID!, $tableId: String) { deleteRecord(recordId: $recordId, tableId: $tableId) }",
        {"recordId": record_id, "tableId": table_id},
    )
    gql_data(
        alice,
        """mutation ReleasePurgeRecord($tableId: String!, $recordId: ID!, $confirmRecordId: String!) {
          purgeRecord(tableId: $tableId, recordId: $recordId, confirmRecordId: $confirmRecordId)
        }""",
        {"tableId": table_id, "recordId": record_id, "confirmRecordId": record_id},
    )
    purged = graphql(
        alice,
        "query ReleasePurgedRecord($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
        {"tableId": table_id, "recordId": record_id},
        allow_errors=True,
    )
    if not purged.get("errors"):
        fail("purged record remained recoverable", purged)


def assert_offline_private_fail_closed(browser: Browser, *, table_id: str, record_id: str) -> None:
    browser.navigate(f"/workbench/{table_id}?recordId={record_id}")
    wait_for(lambda: bool(browser.find_all("canvas")), timeout=30, label="online workbench before offline")
    browser.set_offline(True)
    try:
        result = browser.evaluate_async(
            ASYNC_GRAPHQL,
            [
                "query ReleaseOffline($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
                {"tableId": table_id, "recordId": record_id},
            ],
        )
    finally:
        browser.set_offline(False)
    if not result.get("networkError"):
        fail("offline private GraphQL request was replayed from cache", result)


def assert_primary_surfaces(browser: Browser) -> None:
    routes = (
        ("工作台", "/home"),
        ("数据表", "/tables"),
        ("仪表盘", "/dashboards"),
        ("项目", "/projects"),
        ("自动化", "/automations"),
        ("AI 助手", "/ai"),
        ("通知", "/notifications"),
        ("回收站", "/recycle-bin"),
        ("设置", "/settings"),
        ("帮助", "/help"),
    )
    for label, path in routes:
        browser.navigate(path)
        wait_for(lambda: path in browser.current_url(), timeout=20, label=f"{label} route")
        wait_for(lambda: bool(body_text(browser).strip()), timeout=20, label=f"{label} content")
        text = body_text(browser).lower()
        if "coming soon" in text or "planned" in text or "敬请期待" in text:
            fail(f"{label} rendered placeholder content", text[:500])
