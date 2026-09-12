from __future__ import annotations

from release_gate_support import body_text, fail
from webdriver_client import Browser, wait_for


def _assert_surface(browser: Browser, label: str, path: str) -> None:
    wait_for(
        lambda: browser.current_url().split("?", 1)[0].endswith(path),
        timeout=20,
        label=f"{label} navigation",
    )
    text = body_text(browser).lower()
    if "coming soon" in text or "planned" in text or "敬请期待" in text:
        fail(f"{label} rendered placeholder content", text[:500])


def assert_primary_surfaces_by_click(browser: Browser) -> None:
    browser.navigate("/home")
    wait_for(
        lambda: bool(browser.find_all("aside[aria-label='主导航']")),
        timeout=20,
        label="primary rail",
    )

    rail_routes = (
        ("工作台", "/home"),
        ("数据表", "/tables"),
        ("仪表盘", "/dashboards"),
        ("项目", "/projects"),
        ("自动化", "/automations"),
        ("AI 助手", "/ai"),
        ("通知", "/notifications"),
        ("回收站", "/recycle-bin"),
        ("设置", "/settings"),
    )
    for label, path in rail_routes:
        button = wait_for(
            lambda label=label: (
                browser.find_all(f"button[aria-label='{label}']") or [None]
            )[0],
            timeout=20,
            label=f"{label} primary navigation button",
        )
        browser.click(button)
        _assert_surface(browser, label, path)

    user_menu = wait_for(
        lambda: (browser.find_all("button[aria-label='用户菜单']") or [None])[0],
        timeout=20,
        label="user menu for help navigation",
    )
    browser.click(user_menu)
    help_item = wait_for(
        lambda: next(
            (
                element_id
                for element_id in browser.find_all(".ant-dropdown-menu-item")
                if browser.element_text(element_id).strip() == "帮助中心"
            ),
            None,
        ),
        timeout=20,
        label="help center menu item",
    )
    browser.click(help_item)
    _assert_surface(browser, "帮助", "/help")
