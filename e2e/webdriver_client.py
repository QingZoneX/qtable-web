from __future__ import annotations

import base64
import json
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf"
E2E_LANGUAGE = "zh-CN"
LANGUAGE_STORAGE_KEY = "qtable.language"


class WebDriverError(RuntimeError):
    pass


def _request(method: str, url: str, payload: Any | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise WebDriverError(f"WebDriver HTTP {exc.code}: {details}") from exc
    return json.loads(raw) if raw else None


def _free_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class Browser:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.driver_port = _free_local_port()
        self.driver_url = f"http://127.0.0.1:{self.driver_port}"
        self.process: subprocess.Popen[str] | None = None
        self.session_id: str | None = None

    def start(self) -> None:
        chromedriver = shutil.which("chromedriver")
        chrome = (
            shutil.which("google-chrome")
            or shutil.which("chromium")
            or shutil.which("chromium-browser")
        )
        if not chromedriver or not chrome:
            raise RuntimeError("Chrome and chromedriver are required on the E2E runner")

        self.process = subprocess.Popen(
            [
                chromedriver,
                f"--port={self.driver_port}",
                "--allowed-ips=127.0.0.1",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                status = _request("GET", f"{self.driver_url}/status")
                if status.get("value", {}).get("ready"):
                    break
            except Exception:
                pass
            time.sleep(0.25)
        else:
            raise RuntimeError("chromedriver did not become ready")

        session = _request(
            "POST",
            f"{self.driver_url}/session",
            {
                "capabilities": {
                    "alwaysMatch": {
                        "browserName": "chrome",
                        "goog:loggingPrefs": {"browser": "ALL", "performance": "ALL"},
                        "goog:chromeOptions": {
                            "binary": chrome,
                            "args": [
                                "--headless=new",
                                "--no-sandbox",
                                "--disable-dev-shm-usage",
                                f"--lang={E2E_LANGUAGE}",
                                "--window-size=1440,1000",
                            ],
                            "prefs": {
                                "download.prompt_for_download": False,
                                "download.directory_upgrade": True,
                                "intl.accept_languages": "zh-CN,zh",
                            },
                        },
                    }
                }
            },
        )
        self.session_id = session["value"]["sessionId"]
        self.command(
            "POST",
            "timeouts",
            {"script": 30000, "pageLoad": 30000, "implicit": 0},
        )
        # The release gate asserts the Chinese product contract. GitHub runner
        # images default to an English browser locale, so seed the product's
        # persisted language before any application JavaScript runs. The
        # Chrome locale settings above keep navigator/Accept-Language aligned;
        # this preload makes the test deterministic even if Chrome changes how
        # headless locale preferences are exposed.
        self.cdp(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": (
                    "try { window.localStorage.setItem("
                    f"{json.dumps(LANGUAGE_STORAGE_KEY)}, {json.dumps(E2E_LANGUAGE)}"
                    "); } catch (_) {}"
                )
            },
        )

    def command(self, method: str, path: str, payload: Any | None = None) -> Any:
        if not self.session_id:
            raise RuntimeError("browser session not started")
        return _request(
            method,
            f"{self.driver_url}/session/{self.session_id}/{path}",
            payload,
        )

    def navigate(self, path: str) -> None:
        self.command("POST", "url", {"url": f"{self.base_url}{path}"})

    def refresh(self) -> None:
        self.command("POST", "refresh", {})

    def current_url(self) -> str:
        return str(self.command("GET", "url").get("value") or "")

    def find(self, selector: str) -> str:
        result = self.command(
            "POST",
            "element",
            {"using": "css selector", "value": selector},
        )
        return result["value"][ELEMENT_KEY]

    def find_all(self, selector: str) -> list[str]:
        result = self.command(
            "POST",
            "elements",
            {"using": "css selector", "value": selector},
        )
        return [item[ELEMENT_KEY] for item in result.get("value", [])]

    def element_text(self, element_id: str) -> str:
        result = self.command("GET", f"element/{element_id}/text")
        return str(result.get("value") or "")

    def element_rect(self, element_id: str) -> dict[str, float]:
        result = self.command("GET", f"element/{element_id}/rect")
        value = result.get("value") or {}
        return {
            "x": float(value.get("x") or 0),
            "y": float(value.get("y") or 0),
            "width": float(value.get("width") or 0),
            "height": float(value.get("height") or 0),
        }

    def send_keys(self, element_id: str, text: str) -> None:
        self.command(
            "POST",
            f"element/{element_id}/value",
            {"text": text, "value": list(text)},
        )

    def click(self, element_id: str) -> None:
        self.command("POST", f"element/{element_id}/click", {})

    def click_at(self, element_id: str, x: int, y: int) -> None:
        rect = self.element_rect(element_id)
        viewport_x = int(round(rect["x"] + x))
        viewport_y = int(round(rect["y"] + y))
        self.command(
            "POST",
            "actions",
            {
                "actions": [
                    {
                        "type": "pointer",
                        "id": "mouse",
                        "parameters": {"pointerType": "mouse"},
                        "actions": [
                            {
                                "type": "pointerMove",
                                "duration": 0,
                                "origin": "viewport",
                                "x": viewport_x,
                                "y": viewport_y,
                            },
                            {"type": "pointerDown", "button": 0},
                            {"type": "pointerUp", "button": 0},
                        ],
                    }
                ]
            },
        )
        self.command("DELETE", "actions")

    def cdp(self, cmd: str, params: dict[str, Any] | None = None) -> Any:
        return self.command(
            "POST",
            "goog/cdp/execute",
            {"cmd": cmd, "params": params or {}},
        ).get("value")

    def set_download_directory(self, path: str) -> None:
        self.cdp(
            "Page.setDownloadBehavior",
            {"behavior": "allow", "downloadPath": path},
        )

    def set_offline(self, offline: bool) -> None:
        self.cdp("Network.enable")
        self.cdp(
            "Network.emulateNetworkConditions",
            {
                "offline": offline,
                "latency": 0,
                "downloadThroughput": 0 if offline else -1,
                "uploadThroughput": 0 if offline else -1,
                "connectionType": "none" if offline else "wifi",
            },
        )

    def set_bypass_service_worker(self, bypass: bool) -> None:
        self.cdp("Network.setBypassServiceWorker", {"bypass": bypass})

    def browser_logs(self) -> list[dict[str, Any]]:
        result = self.command("POST", "log", {"type": "browser"})
        return list(result.get("value") or [])

    def performance_logs(self) -> list[dict[str, Any]]:
        result = self.command("POST", "log", {"type": "performance"})
        return list(result.get("value") or [])

    def save_screenshot(self, path: str | Path) -> Path:
        result = self.command("GET", "screenshot")
        output = Path(path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(base64.b64decode(result.get("value") or ""))
        return output

    def evaluate(self, script: str, args: list[Any] | None = None) -> Any:
        result = self.command(
            "POST",
            "execute/sync",
            {"script": script, "args": args or []},
        )
        return result.get("value")

    def evaluate_async(self, script: str, args: list[Any] | None = None) -> Any:
        result = self.command(
            "POST",
            "execute/async",
            {"script": script, "args": args or []},
        )
        return result.get("value")

    def stop(self) -> None:
        if self.session_id:
            try:
                _request("DELETE", f"{self.driver_url}/session/{self.session_id}")
            except Exception:
                pass
            self.session_id = None
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None


def wait_for(predicate, *, timeout: float = 20, label: str = "condition"):
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            value = predicate()
            if value:
                return value
        except Exception as exc:
            last_error = exc
        time.sleep(0.25)
    if last_error:
        raise AssertionError(f"Timed out waiting for {label}: {last_error}") from last_error
    raise AssertionError(f"Timed out waiting for {label}")
