from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from release_gate_access_loss import assert_workspace_access_loss
from release_gate_core import (
    assert_failed_write_no_false_success,
    assert_realtime,
    assert_record_persistence,
    assert_row_permission,
    assert_unshared_denied,
    create_table_fixture,
    grant_table_read,
    invite_viewer,
)
from release_gate_dashboard import assert_dashboard_data
from release_gate_navigation import assert_primary_surfaces_by_click
from release_gate_product import (
    assert_automation,
    assert_collaboration,
    assert_notification_redaction,
    assert_offline_private_fail_closed,
    assert_recycle_lifecycle,
)
from release_gate_query_config import assert_filter_sort_persistence
from release_gate_support import (
    assert_password_reset_safe,
    assert_refresh_rotation,
    default_workspace,
    fail,
    gql_data,
    login_ui,
    logout_ui,
    register_ui,
)
from webdriver_client import Browser


def install_page_error_capture(browser: Browser) -> None:
    browser.cdp(
        "Page.addScriptToEvaluateOnNewDocument",
        {
            "source": """
              window.__releaseE2EPageErrors = [];
              window.addEventListener('error', (event) => {
                const detail = String(event.error?.stack || event.message || event.error || 'window error');
                window.__releaseE2EPageErrors.push(detail);
                console.error('[release-e2e-page-error]', detail);
              });
              window.addEventListener('unhandledrejection', (event) => {
                const detail = String(event.reason?.stack || event.reason || 'unhandled rejection');
                window.__releaseE2EPageErrors.push(detail);
                console.error('[release-e2e-unhandled-rejection]', detail);
              });
            """
        },
    )


def assert_no_page_errors(browser: Browser, name: str) -> None:
    errors = browser.evaluate("return window.__releaseE2EPageErrors || []") or []
    if errors:
        fail(f"{name} page error/unhandled rejection capture is not empty", errors)


def _fatal_console_entries(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    bad: list[dict[str, Any]] = []
    for entry in logs:
        message = str(entry.get("message") or "")
        if "favicon.ico" in message or "ResizeObserver loop" in message:
            continue
        if str(entry.get("level") or "").upper() == "SEVERE":
            bad.append(entry)
    return bad


def _server_error_responses(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    failures: list[dict[str, Any]] = []
    for entry in logs:
        try:
            envelope = json.loads(str(entry.get("message") or "{}"))
            message = envelope.get("message") or {}
            if message.get("method") != "Network.responseReceived":
                continue
            response = (message.get("params") or {}).get("response") or {}
            status = int(float(response.get("status") or 0))
            if status >= 500:
                failures.append(
                    {
                        "status": status,
                        "url": str(response.get("url") or ""),
                        "mimeType": str(response.get("mimeType") or ""),
                    }
                )
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
    return failures


def capture_runtime_evidence(
    browser: Browser,
    artifacts: Path,
    name: str,
    *,
    fail_on_runtime: bool,
) -> None:
    browser.save_screenshot(artifacts / f"{name}.png")
    console = browser.browser_logs()
    performance = browser.performance_logs()
    (artifacts / f"{name}-console.json").write_text(
        json.dumps(console, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    # ChromeDriver's performance stream is the DevTools event trace used for
    # release evidence. Keep the trace name explicit so the artifact contract
    # is screenshot + trace rather than an ambiguous log file.
    (artifacts / f"{name}-devtools-trace.json").write_text(
        json.dumps(performance, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    if fail_on_runtime:
        bad_console = _fatal_console_entries(console)
        if bad_console:
            fail(f"{name} browser console contains SEVERE entries", bad_console)
        server_errors = _server_error_responses(performance)
        if server_errors:
            fail(f"{name} observed unexpected HTTP 5xx responses", server_errors)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:9100")
    parser.add_argument("--artifacts", default=".release-e2e-artifacts")
    args = parser.parse_args()

    alice_email = os.environ.get("QTABLE_RELEASE_E2E_ALICE", "release.alice@example.test")
    bob_email = os.environ.get("QTABLE_RELEASE_E2E_BOB", "release.bob@example.test")
    password = os.environ.get("QTABLE_RELEASE_E2E_PASSWORD", "release-e2e-password-170")
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)

    alice = Browser(args.base_url)
    bob = Browser(args.base_url)
    state: dict[str, Any] = {
        "ok": False,
        "alice": alice_email,
        "bob": bob_email,
    }
    try:
        alice.start()
        bob.start()
        install_page_error_capture(alice)
        install_page_error_capture(bob)

        register_ui(alice, alice_email, password, "Release Alice")
        workspace_id, root_id = default_workspace(alice)
        state["workspaceId"] = workspace_id
        assert_refresh_rotation(alice)
        logout_ui(alice)
        assert_password_reset_safe(alice, alice_email)
        login_ui(alice, alice_email, password)

        register_ui(bob, bob_email, password, "Release Bob")
        default_workspace(bob)
        logout_ui(bob)
        login_ui(bob, bob_email, password)

        fixture = create_table_fixture(alice, workspace_id, root_id)
        state.update(fixture)
        table_id = fixture["table_id"]
        view_id = fixture["view_id"]
        record_id = fixture["record_id"]

        assert_record_persistence(alice, table_id, view_id, record_id)
        state["secondRecordId"] = assert_filter_sort_persistence(
            alice,
            table_id=table_id,
        )
        assert_unshared_denied(bob, table_id, record_id)

        bob_user_id = invite_viewer(alice, workspace_id, bob_email)
        state["bobUserId"] = bob_user_id
        grant_table_read(
            alice,
            workspace_id=workspace_id,
            table_id=table_id,
            user_id=bob_user_id,
        )
        bob.navigate("/tables")
        bob.refresh()
        shared_record = gql_data(
            bob,
            "query ReleaseSharedRecord($tableId: String!, $recordId: ID!) { recordById(tableId: $tableId, recordId: $recordId) }",
            {"tableId": table_id, "recordId": record_id},
        )["recordById"]
        if not shared_record:
            fail("shared viewer could not read record")

        assert_realtime(alice, bob, table_id, record_id)
        assert_row_permission(
            alice,
            bob,
            workspace_id=workspace_id,
            table_id=table_id,
            record_id=record_id,
            alice_email=alice_email,
        )
        notification_id = assert_collaboration(
            alice,
            bob,
            table_id=table_id,
            record_id=record_id,
            bob_user_id=bob_user_id,
        )
        state["notificationId"] = notification_id
        assert_notification_redaction(
            alice,
            bob,
            table_id=table_id,
            notification_id=notification_id,
        )
        assert_workspace_access_loss(
            alice,
            bob,
            workspace_id=workspace_id,
            table_id=table_id,
            record_id=record_id,
            bob_email=bob_email,
            bob_user_id=bob_user_id,
            notification_id=notification_id,
        )
        assert_automation(alice, table_id=table_id, record_id=record_id)
        dashboard_id = assert_dashboard_data(
            alice,
            workspace_id=workspace_id,
            root_id=root_id,
            table_id=table_id,
        )
        state["dashboardId"] = dashboard_id
        assert_failed_write_no_false_success(alice, bob, table_id, record_id)
        assert_offline_private_fail_closed(alice, table_id=table_id, record_id=record_id)
        assert_primary_surfaces_by_click(alice)
        assert_recycle_lifecycle(alice, bob, table_id=table_id, record_id=record_id)

        assert_no_page_errors(alice, "alice")
        assert_no_page_errors(bob, "bob")
        capture_runtime_evidence(alice, artifacts, "alice-final", fail_on_runtime=True)
        capture_runtime_evidence(bob, artifacts, "bob-final", fail_on_runtime=True)

        state["ok"] = True
        (artifacts / "release-e2e-result.json").write_text(
            json.dumps(state, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print("[release-e2e] full-stack primary release gate passed")
    except Exception:
        for name, browser in (("alice-failure", alice), ("bob-failure", bob)):
            try:
                capture_runtime_evidence(browser, artifacts, name, fail_on_runtime=False)
            except Exception:
                pass
        (artifacts / "release-e2e-result.json").write_text(
            json.dumps(state, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        raise
    finally:
        alice.stop()
        bob.stop()


if __name__ == "__main__":
    main()
