from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from webdriver_client import Browser, wait_for

TABLE_ID = "tbl-attachment-browser-e2e"
RECORD_ID = "record-attachment-browser-e2e"
FIELD_ID = "files"
PAYLOAD = "QTable browser attachment release gate\n"

ASYNC_LOGIN = r"""
const done = arguments[arguments.length - 1];
const [email, password] = arguments;
(async () => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });
  const body = await response.json();
  if (response.ok) {
    localStorage.setItem('qtable_token', body.access_token);
    localStorage.setItem('qtable_refresh_token', body.refresh_token);
    localStorage.setItem('qtable_user', JSON.stringify({email, name: email.split('@')[0]}));
  }
  done({status: response.status, body});
})().catch((error) => done({error: String(error && error.stack || error)}));
"""

ASYNC_GRAPHQL = r"""
const done = arguments[arguments.length - 1];
const [query, variables] = arguments;
(async () => {
  const token = localStorage.getItem('qtable_token');
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {'Authorization': `Bearer ${token}`} : {}),
    },
    body: JSON.stringify({query, variables}),
    cache: 'no-store',
  });
  done({status: response.status, body: await response.json()});
})().catch((error) => done({error: String(error && error.stack || error)}));
"""

ASYNC_UPLOAD = r"""
const done = arguments[arguments.length - 1];
const [path, payload] = arguments;
(async () => {
  const token = localStorage.getItem('qtable_token');
  const form = new FormData();
  form.append('file', new File([payload], 'browser-release-gate.txt', {type: 'text/plain'}));
  const response = await fetch(path, {
    method: 'POST',
    headers: token ? {'Authorization': `Bearer ${token}`} : {},
    body: form,
  });
  done({status: response.status, body: await response.json()});
})().catch((error) => done({error: String(error && error.stack || error)}));
"""

ASYNC_DOWNLOAD = r"""
const done = arguments[arguments.length - 1];
const [attachmentId] = arguments;
(async () => {
  const token = localStorage.getItem('qtable_token');
  const response = await fetch(`/api/attachments/${encodeURIComponent(attachmentId)}`, {
    headers: token ? {'Authorization': `Bearer ${token}`} : {},
    cache: 'no-store',
  });
  done({
    status: response.status,
    body: await response.text(),
    cacheControl: response.headers.get('cache-control'),
  });
})().catch((error) => done({error: String(error && error.stack || error)}));
"""


def require_ok(result: dict[str, Any], status: int = 200) -> dict[str, Any]:
    if result.get("error"):
        raise AssertionError(result["error"])
    if result.get("status") != status:
        raise AssertionError(f"expected HTTP {status}, got {result}")
    return result


def login(browser: Browser, email: str, password: str) -> None:
    require_ok(browser.evaluate_async(ASYNC_LOGIN, [email, password]))


def graphql(browser: Browser, query: str, variables: dict[str, Any]) -> Any:
    result = require_ok(browser.evaluate_async(ASYNC_GRAPHQL, [query, variables]))
    body = result["body"]
    if body.get("errors"):
        raise AssertionError(f"GraphQL errors: {body['errors']}")
    return body["data"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:9100")
    parser.add_argument("--result", default=".e2e-attachment-result.json")
    args = parser.parse_args()

    alice_email = os.environ["QTABLE_E2E_ALICE_EMAIL"]
    bob_email = os.environ["QTABLE_E2E_BOB_EMAIL"]
    manager_email = os.environ["QTABLE_E2E_MANAGER_EMAIL"]
    password = os.environ["QTABLE_E2E_PASSWORD"]

    browser = Browser(args.base_url)
    try:
        browser.start()
        browser.navigate("/login")
        email_input = wait_for(
            lambda: browser.find("input[type='email']"),
            label="login email field",
        )
        browser.send_keys(email_input, alice_email)
        browser.send_keys(browser.find("input[type='password']"), password)
        browser.click(browser.find("button[type='submit']"))
        wait_for(
            lambda: browser.evaluate("return Boolean(localStorage.getItem('qtable_token'))"),
            label="UI login completion",
        )

        upload_path = f"/api/attachments/tables/{TABLE_ID}/records/{RECORD_ID}/fields/{FIELD_ID}"
        uploaded = require_ok(browser.evaluate_async(ASYNC_UPLOAD, [upload_path, PAYLOAD]))["body"]
        attachment = uploaded["attachment"]
        assert set(attachment) == {"attachmentId", "objectKey", "name", "size", "contentType"}
        assert "url" not in attachment
        assert attachment["name"] == "browser-release-gate.txt"
        assert attachment["size"] == len(PAYLOAD.encode("utf-8"))
        assert uploaded["attachments"] == [attachment]

        record = graphql(
            browser,
            "query RecordById($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
            {"tableId": TABLE_ID, "recordId": RECORD_ID},
        )["recordById"]
        assert record[FIELD_ID] == [attachment]

        first_download = require_ok(
            browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]])
        )
        assert first_download["body"] == PAYLOAD
        assert first_download["cacheControl"] == "private, no-store"

        graphql(
            browser,
            "mutation UpdateRecord($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) { updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId) }",
            {"recordId": RECORD_ID, "fieldId": "owner", "value": ["927102"], "tableId": TABLE_ID},
        )
        alice_denied = browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]])
        assert alice_denied["status"] == 404, alice_denied

        login(browser, bob_email, password)
        bob_download = require_ok(browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]]))
        assert bob_download["body"] == PAYLOAD

        graphql(
            browser,
            "mutation DeleteRecord($recordId: ID!, $tableId: String) { deleteRecord(recordId: $recordId, tableId: $tableId) }",
            {"recordId": RECORD_ID, "tableId": TABLE_ID},
        )
        recycled_denied = browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]])
        assert recycled_denied["status"] == 404, recycled_denied

        login(browser, manager_email, password)
        recycle = graphql(
            browser,
            "query RecycleBin($tableId: String!, $offset: Int!, $limit: Int!) { recycleBin(tableId: $tableId, offset: $offset, limit: $limit) }",
            {"tableId": TABLE_ID, "offset": 0, "limit": 20},
        )["recycleBin"]
        assert any(item.get("recordId") == RECORD_ID for item in recycle.get("items", []))

        graphql(
            browser,
            "mutation RestoreRecord($tableId: String!, $recordId: ID!) { restoreRecord(tableId: $tableId, recordId: $recordId) }",
            {"tableId": TABLE_ID, "recordId": RECORD_ID},
        )
        restored = require_ok(browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]]))
        assert restored["body"] == PAYLOAD

        graphql(
            browser,
            "mutation DeleteRecord($recordId: ID!, $tableId: String) { deleteRecord(recordId: $recordId, tableId: $tableId) }",
            {"recordId": RECORD_ID, "tableId": TABLE_ID},
        )
        graphql(
            browser,
            "mutation PurgeRecord($tableId: String!, $recordId: ID!, $confirmRecordId: String!) { purgeRecord(tableId: $tableId, recordId: $recordId, confirmRecordId: $confirmRecordId) }",
            {"tableId": TABLE_ID, "recordId": RECORD_ID, "confirmRecordId": RECORD_ID},
        )
        purged_denied = browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]])
        assert purged_denied["status"] == 404, purged_denied

        Path(args.result).write_text(
            json.dumps(
                {
                    "attachmentId": attachment["attachmentId"],
                    "objectKey": attachment["objectKey"],
                    "tableId": TABLE_ID,
                    "recordId": RECORD_ID,
                }
            ),
            encoding="utf-8",
        )
        print("[attachment-browser-e2e] lifecycle passed")
    finally:
        browser.stop()


if __name__ == "__main__":
    main()
