from __future__ import annotations

import unittest
from pathlib import Path

from release_gate_support import _wait_for_auth_token


class FakeAuthBrowser:
    def __init__(self, *, token: bool, response: dict | None = None):
        self.token = token
        self.response = response

    def evaluate(self, script: str, args=None):
        if "Boolean(localStorage.getItem" in script:
            return self.token
        if "window[arguments[0]]" in script:
            return self.response
        if "document.body.innerText" in script:
            return "registration page"
        raise AssertionError(f"unexpected script: {script}")

    def current_url(self) -> str:
        return "http://example.test/register"


class AuthFailureDiagnosticsTest(unittest.TestCase):
    def test_auth_http_failure_is_reported_without_waiting_for_timeout(self) -> None:
        browser = FakeAuthBrowser(
            token=False,
            response={
                "status": 422,
                "ok": False,
                "body": '{"detail":"invalid email"}',
            },
        )

        with self.assertRaisesRegex(AssertionError, "422"):
            _wait_for_auth_token(browser, "capture", "registration")

    def test_auth_success_accepts_persisted_token(self) -> None:
        browser = FakeAuthBrowser(token=True)
        _wait_for_auth_token(browser, "capture", "registration")

    def test_real_backend_fixtures_do_not_use_rejected_test_email_domain(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        fixture_paths = (
            ".github/workflows/full-stack-release-e2e.yml",
            ".github/workflows/attachment-e2e.yml",
            "e2e/run_full_stack_release_gate.py",
            "e2e/seed_attachment_release_gate.py",
        )
        for relative_path in fixture_paths:
            contents = (repository / relative_path).read_text(encoding="utf-8")
            self.assertNotIn("@example.test", contents, relative_path)


if __name__ == "__main__":
    unittest.main()
