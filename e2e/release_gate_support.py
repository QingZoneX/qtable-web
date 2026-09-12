from __future__ import annotations

import base64
import json
from typing import Any

from webdriver_client import Browser, wait_for

ASYNC_FETCH = r"""
const done = arguments[arguments.length - 1];
const [path, options] = arguments;
(async () => {
  const response = await fetch(path, options || {});
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  done({status: response.status, ok: response.ok, body});
})().catch((error) => done({networkError: String(error && error.stack || error)}));
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
  const body = await response.json();
  done({status: response.status, body});
})().catch((error) => done({networkError: String(error && error.stack || error)}));
"""


def fail(message: str, payload: Any | None = None) -> None:
    if payload is None:
        raise AssertionError(message)
    raise AssertionError(f"{message}: {payload!r}")


def graphql(
    browser: Browser,
    query: str,
    variables: dict[str, Any] | None = None,
    *,
    allow_errors: bool = False,
) -> Any:
    result = browser.evaluate_async(ASYNC_GRAPHQL, [query, variables or {}])
    if result.get("networkError"):
        fail("GraphQL network error", result)
    if result.get("status") != 200:
        fail("GraphQL HTTP status", result)
    body = result.get("body") or {}
    if body.get("errors") and not allow_errors:
        fail("GraphQL errors", body["errors"])
    return body


def gql_data(browser: Browser, query: str, variables: dict[str, Any] | None = None) -> Any:
    return graphql(browser, query, variables).get("data")


def body_text(browser: Browser) -> str:
    return str(browser.evaluate("return document.body.innerText") or "")


def register_ui(browser: Browser, email: str, password: str, name: str) -> None:
    browser.navigate("/register")
    wait_for(lambda: browser.find("input[type='email']"), label="register email")
    browser.send_keys(browser.find("input[placeholder='请输入姓名']"), name)
    browser.send_keys(browser.find("input[type='email']"), email)
    passwords = browser.find_all("input[type='password']")
    if not passwords:
        fail("register password field missing")
    browser.send_keys(passwords[0], password)
    browser.click(browser.find("button[type='submit']"))
    wait_for(
        lambda: browser.evaluate("return Boolean(localStorage.getItem('qtable_token'))"),
        timeout=30,
        label="registration token",
    )
    wait_for(
        lambda: "/register" not in browser.current_url(),
        timeout=30,
        label="registration redirect",
    )


def login_ui(browser: Browser, email: str, password: str) -> None:
    browser.navigate("/login")
    wait_for(lambda: browser.find("input[type='email']"), label="login email")
    browser.send_keys(browser.find("input[type='email']"), email)
    passwords = browser.find_all("input[type='password']")
    if not passwords:
        fail("login password field missing")
    browser.send_keys(passwords[0], password)
    browser.click(browser.find("button[type='submit']"))
    wait_for(
        lambda: browser.evaluate("return Boolean(localStorage.getItem('qtable_token'))"),
        timeout=30,
        label="login token",
    )
    wait_for(
        lambda: "/login" not in browser.current_url(),
        timeout=30,
        label="login redirect",
    )


def logout_ui(browser: Browser) -> None:
    browser.click(browser.find("button[aria-label='用户菜单']"))
    logout_item = wait_for(
        lambda: next(
            (
                element_id
                for element_id in browser.find_all(".ant-dropdown-menu-item")
                if browser.element_text(element_id).strip() == "退出登录"
            ),
            None,
        ),
        label="logout menu item",
    )
    browser.click(logout_item)
    wait_for(lambda: "/login" in browser.current_url(), label="logout redirect")
    if browser.evaluate("return localStorage.getItem('qtable_token')"):
        fail("logout left access token in localStorage")


def default_workspace(browser: Browser) -> tuple[str, str]:
    payload = gql_data(browser, "query ReleaseWorkspaces { workspaces }")["workspaces"]
    owned = payload.get("owned") or []
    if len(owned) != 1:
        fail("fresh account must have exactly one owned default workspace", payload)
    workspace = owned[0]
    workspace_id = str(workspace["id"])
    root_id = str(workspace.get("rootId") or "")
    if not root_id:
        value = gql_data(
            browser,
            "query ReleaseWorkspace($workspaceId: String) { workspace(workspaceId: $workspaceId) }",
            {"workspaceId": workspace_id},
        )["workspace"]
        root_id = str((value.get("root") or {}).get("id") or "")
    if not root_id:
        fail("default workspace root id missing")
    return workspace_id, root_id


def _claims(token: str) -> dict[str, Any]:
    part = token.split(".")[1]
    part += "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(part).decode("utf-8"))


def assert_refresh_rotation(browser: Browser) -> None:
    access_before = browser.evaluate("return localStorage.getItem('qtable_token')")
    refresh_before = browser.evaluate("return localStorage.getItem('qtable_refresh_token')")
    if not access_before or not refresh_before:
        fail("missing tokens before refresh")
    result = browser.evaluate_async(
        ASYNC_FETCH,
        [
            "/auth/refresh",
            {
                "method": "POST",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"refresh_token": refresh_before}),
            },
        ],
    )
    if result.get("status") != 200:
        fail("refresh request failed", result)
    payload = result["body"]
    if payload["access_token"] == access_before or payload["refresh_token"] == refresh_before:
        fail("refresh did not rotate both tokens")
    if _claims(payload["access_token"]).get("sid") != _claims(access_before).get("sid"):
        fail("refresh changed session id")
    browser.evaluate(
        "localStorage.setItem('qtable_token', arguments[0]); localStorage.setItem('qtable_refresh_token', arguments[1]);",
        [payload["access_token"], payload["refresh_token"]],
    )


def assert_password_reset_safe(browser: Browser, email: str) -> None:
    browser.navigate("/forgot-password")
    wait_for(lambda: browser.find("input[type='email']"), label="forgot email")
    browser.send_keys(browser.find("input[type='email']"), email)
    browser.click(browser.find("button[type='submit']"))
    wait_for(
        lambda: "如果账号存在" in body_text(browser),
        timeout=20,
        label="generic password reset",
    )
    text = body_text(browser).lower()
    if "debug_reset_token" in text or "reset token" in text or "复制重置" in text:
        fail("password reset UI exposed credential material")


def assert_no_fatal_console(browser: Browser, name: str) -> None:
    bad = []
    for entry in browser.browser_logs():
        message = str(entry.get("message") or "")
        if "favicon.ico" in message or "ResizeObserver loop" in message:
            continue
        if str(entry.get("level") or "").upper() == "SEVERE":
            bad.append(entry)
    if bad:
        fail(f"{name} browser console contains SEVERE entries", bad)
