from __future__ import annotations

import unittest
from unittest.mock import call, patch

import webdriver_client


class WebDriverConfigurationTest(unittest.TestCase):
    def test_browser_start_pins_release_gate_language(self) -> None:
        requests: list[tuple[str, str, object]] = []

        def fake_which(executable: str) -> str | None:
            if executable == "chromedriver":
                return "/test/chromedriver"
            if executable == "google-chrome":
                return "/test/google-chrome"
            return None

        def fake_request(method: str, url: str, payload: object = None) -> object:
            requests.append((method, url, payload))
            if url.endswith("/status"):
                return {"value": {"ready": True}}
            if method == "POST" and url.endswith("/session"):
                return {"value": {"sessionId": "test-session"}}
            return {"value": {}}

        with (
            patch.object(webdriver_client.shutil, "which", side_effect=fake_which),
            patch.object(webdriver_client.subprocess, "Popen", return_value=object()),
            patch.object(webdriver_client, "_request", side_effect=fake_request),
        ):
            webdriver_client.Browser("http://example.test").start()

        session_payload = next(
            payload
            for method, url, payload in requests
            if method == "POST" and url.endswith("/session")
        )
        chrome_options = session_payload["capabilities"]["alwaysMatch"][
            "goog:chromeOptions"
        ]
        self.assertIn("--lang=zh-CN", chrome_options["args"])
        self.assertEqual(
            chrome_options["prefs"]["intl.accept_languages"],
            "zh-CN,zh",
        )

        preload_payload = next(
            payload
            for method, url, payload in requests
            if method == "POST"
            and url.endswith("/goog/cdp/execute")
            and payload["cmd"] == "Page.addScriptToEvaluateOnNewDocument"
        )
        preload_source = preload_payload["params"]["source"]
        self.assertIn('"qtable.language"', preload_source)
        self.assertIn('"zh-CN"', preload_source)

    def test_service_worker_bypass_uses_network_domain(self) -> None:
        browser = webdriver_client.Browser("http://example.test")

        with patch.object(browser, "cdp") as cdp:
            browser.set_bypass_service_worker(True)
            browser.set_bypass_service_worker(False)

        self.assertEqual(
            cdp.call_args_list,
            [
                call("Network.setBypassServiceWorker", {"bypass": True}),
                call("Network.setBypassServiceWorker", {"bypass": False}),
            ],
        )

if __name__ == "__main__":
    unittest.main()
