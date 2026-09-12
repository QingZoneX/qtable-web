from __future__ import annotations

from webdriver_client import Browser, wait_for
from release_gate_support import fail, gql_data


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
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows or rows[0].get("value") is None:
        fail("dashboard widget did not return real metric rows", payload)
    if float(rows[0]["value"]) < 1:
        fail("dashboard row-count metric did not see the release record", payload)

    browser.navigate(f"/workbench/{dashboard_id}")
    wait_for(lambda: dashboard_id in browser.current_url(), timeout=20, label="dashboard workbench")
    return dashboard_id
