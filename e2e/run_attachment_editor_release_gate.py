from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from webdriver_client import Browser, wait_for

TABLE_ID = "tbl-attachment-browser-e2e"
VIEW_ID = "view-attachment-browser-e2e"
RECORD_ID = "record-attachment-browser-e2e"
FIELD_ID = "files"
PAYLOAD = "QTable browser attachment release gate\n"
FILES_CELL_X = 80 + 150 + 150 + 75
FIRST_BODY_ROW_Y = 44 + 22

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

ASYNC_DOWNLOAD = r"""
const done = arguments[arguments.length - 1];
const [attachmentId] = arguments;
(async () => {
  const token = localStorage.getItem('qtable_token');
  const response = await fetch(`/api/attachments/${encodeURIComponent(attachmentId)}`, {
    headers: token ? {'Authorization': `Bearer ${token}`} : {},
    cache: 'no-store',
  });
  done({status: response.status, body: await response.text()});
})().catch((error) => done({error: String(error && error.stack || error)}));
"""


def require_ok(result: dict[str, Any], status: int = 200) -> dict[str, Any]:
    if result.get("error"):
        raise AssertionError(result["error"])
    if result.get("status") != status:
        raise AssertionError(f"expected HTTP {status}, got {result}")
    return result


def login_via_api(browser: Browser, email: str, password: str) -> None:
    require_ok(browser.evaluate_async(ASYNC_LOGIN, [email, password]))


def graphql(browser: Browser, query: str, variables: dict[str, Any]) -> Any:
    result = require_ok(browser.evaluate_async(ASYNC_GRAPHQL, [query, variables]))
    body = result["body"]
    if body.get("errors"):
        raise AssertionError(f"GraphQL errors: {body['errors']}")
    return body["data"]


def largest_canvas(browser: Browser) -> str | None:
    candidates = []
    for element_id in browser.find_all("canvas"):
        rect = browser.element_rect(element_id)
        if rect["width"] >= 590 and rect["height"] >= 88:
            candidates.append((rect["width"] * rect["height"], element_id))
    return max(candidates, default=(0, None))[1]


def open_attachment_editor(browser: Browser) -> str:
    def open_or_find() -> str | None:
        try:
            return browser.find("input[type='file']")
        except Exception:
            canvas = largest_canvas(browser)
            if canvas:
                browser.click_at(canvas, FILES_CELL_X, FIRST_BODY_ROW_Y)
            return None

    return wait_for(
        open_or_find,
        timeout=30,
        label="interactive AttachmentEditor file input",
    )


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

        workbench_path = f"/workbench/{TABLE_ID}/{VIEW_ID}"
        browser.navigate(workbench_path)
        file_input = open_attachment_editor(browser)

        with tempfile.TemporaryDirectory(prefix="qtable-attachment-e2e-") as temp_dir:
            upload_path = Path(temp_dir) / "browser-release-gate.txt"
            upload_path.write_text(PAYLOAD, encoding="utf-8")
            browser.send_keys(file_input, str(upload_path.resolve()))

            preview_selector = 'button[aria-label="Preview browser-release-gate.txt"]'
            wait_for(
                lambda: browser.find(preview_selector),
                timeout=30,
                label="uploaded attachment in real editor",
            )

            record = graphql(
                browser,
                "query RecordById($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
                {"tableId": TABLE_ID, "recordId": RECORD_ID},
            )["recordById"]
            stored = record[FIELD_ID]
            assert isinstance(stored, list) and len(stored) == 1, stored
            attachment = stored[0]
            assert set(attachment) == {
                "attachmentId",
                "objectKey",
                "name",
                "size",
                "contentType",
            }
            assert "url" not in attachment
            assert attachment["name"] == "browser-release-gate.txt"
            assert attachment["size"] == len(PAYLOAD.encode("utf-8"))

            # Persistence must survive a full document reload. Re-open the same
            # real VTable cell and preview via AttachmentEditor, not by API fetch.
            browser.refresh()
            wait_for(
                lambda: browser.evaluate("return document.readyState === 'complete'"),
                label="workbench reload",
            )
            open_attachment_editor(browser)
            preview_button = wait_for(
                lambda: browser.find(preview_selector),
                timeout=30,
                label="persisted attachment after refresh",
            )
            browser.click(preview_button)
            wait_for(
                lambda: browser.evaluate(
                    "return document.body.innerText.includes(arguments[0])",
                    [PAYLOAD.strip()],
                ),
                timeout=30,
                label="real AttachmentEditor text preview",
            )

            download_dir = Path(temp_dir) / "downloads"
            download_dir.mkdir()
            browser.set_download_directory(str(download_dir.resolve()))
            browser.click(browser.find(".ant-modal-footer button"))
            downloaded = download_dir / "browser-release-gate.txt"
            wait_for(downloaded.exists, timeout=30, label="real attachment download")
            assert downloaded.read_text(encoding="utf-8") == PAYLOAD

        # Remaining lifecycle operations deliberately use the product API to
        # change authorization/recycle state; the attachment user path above is
        # fully exercised through the real editor UI.
        graphql(
            browser,
            "mutation UpdateRecord($recordId: ID!, $fieldId: String!, $value: JSON, $tableId: String) { updateRecord(recordId: $recordId, fieldId: $fieldId, value: $value, tableId: $tableId) }",
            {"recordId": RECORD_ID, "fieldId": "owner", "value": ["927102"], "tableId": TABLE_ID},
        )
        alice_denied = browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]])
        assert alice_denied["status"] == 404, alice_denied

        login_via_api(browser, bob_email, password)
        bob_download = require_ok(browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]]))
        assert bob_download["body"] == PAYLOAD

        graphql(
            browser,
            "mutation DeleteRecord($recordId: ID!, $tableId: String) { deleteRecord(recordId: $recordId, tableId: $tableId) }",
            {"recordId": RECORD_ID, "tableId": TABLE_ID},
        )
        recycled_denied = browser.evaluate_async(ASYNC_DOWNLOAD, [attachment["attachmentId"]])
        assert recycled_denied["status"] == 404, recycled_denied

        login_via_api(browser, manager_email, password)
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
        print("[attachment-editor-e2e] real UI lifecycle passed")
    finally:
        browser.stop()


if __name__ == "__main__":
    main()
