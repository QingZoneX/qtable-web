from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import threading
from urllib.parse import urlsplit

from webdriver_client import Browser, wait_for


BUSINESS_PATHS = (
    "/api/private",
    "/graphql",
    "/auth/session",
    "/oauth/test",
    "/ws/test",
)
STATIC_ASSET_PATH = "/assets/app-deadbeef.js"


class GateServer(ThreadingHTTPServer):
    private_online = True


class Handler(BaseHTTPRequestHandler):
    server: GateServer
    sw_source: bytes = b""

    def log_message(self, _format: str, *_args) -> None:
        return

    def _write(
        self,
        status: int,
        body: bytes,
        *,
        content_type: str = "text/plain; charset=utf-8",
        cache_control: str = "no-store",
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache_control)
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _drop_connection(self) -> None:
        try:
            self.connection.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            self.connection.close()
        except OSError:
            pass

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler contract
        path = urlsplit(self.path).path

        if path in {"/", "/test.html"}:
            self._write(
                200,
                b"<!doctype html><html><body><div id='ready'>ready</div></body></html>",
                content_type="text/html; charset=utf-8",
            )
            return

        if path == "/sw.js":
            self._write(
                200,
                self.sw_source,
                content_type="text/javascript; charset=utf-8",
                extra_headers={"Service-Worker-Allowed": "/"},
            )
            return

        if path == STATIC_ASSET_PATH:
            self._write(
                200,
                b"window.__qtableStaticAssetLoaded = (window.__qtableStaticAssetLoaded || 0) + 1;",
                content_type="text/javascript; charset=utf-8",
                cache_control="public, max-age=31536000, immutable",
            )
            return

        if path in BUSINESS_PATHS:
            if not self.server.private_online:
                # A transport failure forces Service Worker fetch(request) to
                # reject. The vulnerable old worker would catch this and replay
                # its api-v1 entry; the fixed worker must surface the failure.
                self._drop_connection()
                return
            user = self.headers.get("X-Test-User", "anonymous")
            payload = f"{path}:private:{user}".encode("utf-8")
            self._write(200, payload, cache_control="private, no-store")
            return

        self._write(404, b"not found")


def _cache_snapshot(browser: Browser) -> dict[str, list[str]]:
    result = browser.evaluate_async(
        """
        const done = arguments[arguments.length - 1];
        (async () => {
          const result = {};
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            result[name] = (await cache.keys()).map((request) => {
              const url = new URL(request.url);
              return `${url.pathname}${url.search}`;
            });
          }
          done(result);
        })().catch((error) => done({__error: String(error)}));
        """
    )
    if result.get("__error"):
        raise AssertionError(result["__error"])
    return result


def _fetch_private(browser: Browser, path: str, user: str) -> dict:
    return browser.evaluate_async(
        """
        const path = arguments[0];
        const user = arguments[1];
        const done = arguments[arguments.length - 1];
        fetch(path, {
          method: 'GET',
          headers: {'X-Test-User': user},
          cache: 'no-store',
        })
          .then(async (response) => done({
            ok: true,
            status: response.status,
            text: await response.text(),
          }))
          .catch((error) => done({ok: false, error: String(error)}));
        """,
        [path, user],
    )


def _assert_no_business_cache(snapshot: dict[str, list[str]]) -> None:
    for cache_name, paths in snapshot.items():
        for business_path in BUSINESS_PATHS:
            if business_path in paths:
                raise AssertionError(
                    f"private business response cached: {cache_name} -> {business_path}"
                )


def run_gate(base_url: str, result_path: Path) -> None:
    browser = Browser(base_url)
    evidence: dict[str, object] = {}
    try:
        browser.start()
        browser.navigate("/test.html")

        # Model an upgrade from the vulnerable release before installing the new
        # worker: old api-v1 contains user A's private response.
        seeded = browser.evaluate_async(
            """
            const done = arguments[arguments.length - 1];
            (async () => {
              const cache = await caches.open('api-v1');
              await cache.put('/api/private', new Response('seeded-private:A'));
              done(await caches.keys());
            })().catch((error) => done({error: String(error)}));
            """
        )
        if isinstance(seeded, dict) and seeded.get("error"):
            raise AssertionError(seeded["error"])
        assert "api-v1" in seeded, seeded

        registration = browser.evaluate_async(
            """
            const done = arguments[arguments.length - 1];
            (async () => {
              const registration = await navigator.serviceWorker.register('/sw.js', {scope: '/'});
              await navigator.serviceWorker.ready;
              done({ok: true, scope: registration.scope});
            })().catch((error) => done({ok: false, error: String(error)}));
            """
        )
        assert registration.get("ok") is True, registration

        wait_for(
            lambda: browser.evaluate("return Boolean(navigator.serviceWorker.controller);"),
            timeout=15,
            label="service worker controller",
        )
        wait_for(
            lambda: "api-v1" not in _cache_snapshot(browser),
            timeout=15,
            label="activate legacy api-v1 cleanup",
        )
        evidence["after_activate"] = _cache_snapshot(browser)

        # User A can read live private data, but no business route may enter any
        # Cache Storage bucket.
        for path in BUSINESS_PATHS:
            response = _fetch_private(browser, path, "A")
            assert response == {
                "ok": True,
                "status": 200,
                "text": f"{path}:private:A",
            }, response
        after_a = _cache_snapshot(browser)
        _assert_no_business_cache(after_a)
        evidence["after_user_a"] = after_a

        # Backend/network loss after A has read the resource must be a hard
        # failure, never a stale private replay.
        server = Handler.server_ref
        server.private_online = False
        offline_a = _fetch_private(browser, "/api/private", "A")
        assert offline_a.get("ok") is False, offline_a
        evidence["offline_user_a"] = offline_a
        server.private_online = True

        # Simulate both a historical business cache and a future regression that
        # accidentally put private data into the current QTable static cache.
        seeded_logout = browser.evaluate_async(
            """
            const done = arguments[arguments.length - 1];
            (async () => {
              const business = await caches.open('qtable-business-v1');
              await business.put('/api/private', new Response('legacy-private:A'));
              const currentStatic = await caches.open('qtable-static-v2');
              await currentStatic.put('/api/private', new Response('future-regression-private:A'));
              navigator.serviceWorker.controller.postMessage({type: 'CLEAR_PRIVATE_CACHES'});
              done(true);
            })().catch((error) => done({error: String(error)}));
            """
        )
        assert seeded_logout is True, seeded_logout
        wait_for(
            lambda: not any(
                name.startswith("qtable-") or name in {"api-v1", "static-v1"}
                for name in _cache_snapshot(browser)
            ),
            timeout=15,
            label="logout private cache cleanup",
        )
        evidence["after_logout_cleanup"] = _cache_snapshot(browser)

        # Same browser, new user B. The same URL must resolve to B over the
        # network and then fail when the backend disappears; A can never reappear.
        online_b = _fetch_private(browser, "/api/private", "B")
        assert online_b == {
            "ok": True,
            "status": 200,
            "text": "/api/private:private:B",
        }, online_b
        server.private_online = False
        offline_b = _fetch_private(browser, "/api/private", "B")
        assert offline_b.get("ok") is False, offline_b
        assert "private:A" not in json.dumps(offline_b), offline_b
        evidence["online_user_b"] = online_b
        evidence["offline_user_b"] = offline_b
        server.private_online = True

        # Positive static-cache contract: only a real static destination under
        # /assets/ is cached. Dynamic fetch() has destination='', so use a script
        # element to exercise the browser's actual destination='script' request.
        loaded = browser.evaluate_async(
            f"""
            const done = arguments[arguments.length - 1];
            const script = document.createElement('script');
            script.src = '{STATIC_ASSET_PATH}';
            script.onload = () => done({{ok: true, loaded: window.__qtableStaticAssetLoaded}});
            script.onerror = () => done({{ok: false}});
            document.head.appendChild(script);
            """
        )
        assert loaded == {"ok": True, "loaded": 1}, loaded
        final_snapshot = _cache_snapshot(browser)
        assert STATIC_ASSET_PATH in final_snapshot.get("qtable-static-v2", []), final_snapshot
        _assert_no_business_cache(final_snapshot)
        evidence["final_cache_snapshot"] = final_snapshot

        result_path.write_text(
            json.dumps({"ok": True, "evidence": evidence}, indent=2, sort_keys=True),
            encoding="utf-8",
        )
    finally:
        browser.stop()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--result", default=".e2e-service-worker-result.json")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    Handler.sw_source = (repo_root / "public" / "sw.js").read_bytes()

    server = GateServer(("127.0.0.1", 0), Handler)
    Handler.server_ref = server
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        run_gate(f"http://{host}:{port}", Path(args.result))
        print("[service-worker-browser] private cache safety verified")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
