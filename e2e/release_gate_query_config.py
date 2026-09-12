from __future__ import annotations

from webdriver_client import Browser
from release_gate_support import fail, gql_data


def assert_filter_sort_persistence(browser: Browser, *, table_id: str) -> str:
    second = gql_data(
        browser,
        "mutation ReleaseInsertSecond($tableId: String, $data: JSON) { insertRow(tableId: $tableId, data: $data) }",
        {
            "tableId": table_id,
            "data": {"release_title": "beta-seed", "release_status": "ready"},
        },
    )["insertRow"]
    second_id = str(second.get("id") or "")
    if not second_id:
        fail("second record id missing", second)

    release_filter = {
        "id": "release-filter",
        "fieldId": "release_status",
        "operator": "equals",
        "value": "ready",
    }
    release_sort = {
        "id": "release-sort",
        "fieldId": "release_title",
        "order": "desc",
    }
    gql_data(
        browser,
        "mutation ReleaseAddFilter($filter: JSON!, $tableId: String) { addFilter(filter: $filter, tableId: $tableId) }",
        {"filter": release_filter, "tableId": table_id},
    )
    gql_data(
        browser,
        "mutation ReleaseAddSort($sort: JSON!, $tableId: String) { addSort(sort: $sort, tableId: $tableId) }",
        {"sort": release_sort, "tableId": table_id},
    )

    config = gql_data(
        browser,
        "query ReleaseSavedQueryConfig($tableId: String) { filters(tableId: $tableId) sorts(tableId: $tableId) }",
        {"tableId": table_id},
    )
    if not any(str(item.get("id")) == "release-filter" for item in (config.get("filters") or [])):
        fail("saved filter missing after round-trip", config)
    if not any(
        str(item.get("id")) == "release-sort" and str(item.get("order")) == "desc"
        for item in (config.get("sorts") or [])
    ):
        fail("saved sort missing after round-trip", config)

    page = gql_data(
        browser,
        """query ReleaseFilterSort($tableId: String, $filters: [JSON!], $sorts: [JSON!], $offset: Int!, $limit: Int!) {
          queryRecords(tableId: $tableId, filters: $filters, sorts: $sorts, offset: $offset, limit: $limit)
        }""",
        {
            "tableId": table_id,
            "filters": [release_filter],
            "sorts": [release_sort],
            "offset": 0,
            "limit": 20,
        },
    )["queryRecords"]
    records = page.get("records") or []
    titles = [str(item.get("release_title") or "") for item in records]
    if "alpha-seed" not in titles or "beta-seed" not in titles:
        fail("filter excluded expected ready records", page)
    if titles.index("beta-seed") > titles.index("alpha-seed"):
        fail("descending title sort was not applied", page)
    return second_id
