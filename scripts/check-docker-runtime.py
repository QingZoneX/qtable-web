"""Exercise the built Nginx image on a Linux Docker host using only stdlib."""

import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Upstream(BaseHTTPRequestHandler):
    def do_GET(self):
        self.respond()

    def do_POST(self):
        self.respond()

    def respond(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        result = json.dumps({
            "path": self.path,
            "method": self.command,
            "body": body.decode(),
            "authorization": self.headers.get("Authorization"),
            "cookie": self.headers.get("Cookie"),
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(result)))
        self.end_headers()
        self.wfile.write(result)

    def log_message(self, *_args):
        pass


def docker(*args, check=True):
    return subprocess.run(
        ["docker", *args], check=check, text=True, capture_output=True, timeout=60
    ).stdout


def request_with_headers(port, path, data=None):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=data,
        headers={
            "Authorization": "Bearer smoke-test-placeholder",
            "Cookie": "smoke=placeholder",
            "Content-Type": "application/json",
        },
    )
    # Do not send local smoke traffic through a runner's outbound proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        response = opener.open(req, timeout=3)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read(), dict(response.headers.items())


def request(port, path, data=None):
    status, body, _headers = request_with_headers(port, path, data)
    return status, body


def assert_security_headers(headers, *, port, context):
    normalized = {str(key).lower(): str(value) for key, value in headers.items()}
    assert normalized.get("x-content-type-options", "").lower() == "nosniff", (
        context,
        normalized,
    )
    assert normalized.get("referrer-policy", "").lower() == "strict-origin-when-cross-origin", (
        context,
        normalized,
    )
    assert normalized.get("x-frame-options", "").upper() == "DENY", (context, normalized)

    permissions = normalized.get("permissions-policy", "").replace(" ", "").lower()
    for feature in ("camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"):
        assert feature in permissions, (context, feature, permissions)

    csp = normalized.get("content-security-policy", "")
    required_directives = (
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        f"connect-src 'self' ws://127.0.0.1:{port} wss://127.0.0.1:{port}",
        "frame-src 'self' blob:",
        "worker-src 'self' blob:",
        "media-src 'self' blob:",
        "manifest-src 'self'",
    )
    for directive in required_directives:
        assert directive in csp, (context, directive, csp)
    assert "'unsafe-eval'" not in csp, (context, csp)
    script_directive = next(
        (part.strip() for part in csp.split(";") if part.strip().startswith("script-src ")),
        "",
    )
    assert "'unsafe-inline'" not in script_directive, (context, script_directive)


def check_image(image, port, custom_port):
    upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    thread = threading.Thread(target=upstream.serve_forever, daemon=True)
    thread.start()
    name = "qtable-ui-smoke-" + uuid.uuid4().hex[:12]
    try:
        args = [
            "run", "--detach", "--network", "host", "--name", name,
            "-e", "QTABLE_HOST=127.0.0.1",
            "-e", f"QTABLE_PORT={upstream.server_port}",
            # The custom renderer must preserve Nginx variables regardless of
            # the official entrypoint's envsubst filter setting.
            "-e", "NGINX_ENVSUBST_FILTER=^UNRELATED$",
        ]
        if custom_port:
            args += ["-e", f"PORT={port}"]
        docker(*args, image)
        for _ in range(30):
            if docker("inspect", "-f", "{{.State.Running}}", name).strip() != "true":
                raise AssertionError("container exited during startup")
            try:
                if request(port, "/healthz") == (200, b"ok\n"):
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(1)
        else:
            raise AssertionError("container did not become healthy")

        docker("exec", name, "nginx", "-t")
        config = docker("exec", name, "cat", "/etc/nginx/conf.d/default.conf")
        for variable in ("$host", "$remote_addr", "$http_upgrade", "$uri"):
            assert variable in config, f"Nginx variable was substituted: {variable}"
        for variable in ("${PORT}", "${QTABLE_HOST}", "${QTABLE_PORT}"):
            assert variable not in config, f"runtime variable was not rendered: {variable}"
        security_snippet = docker(
            "exec", name, "cat", "/etc/nginx/snippets/qtable-security-headers.conf"
        )
        assert "Content-Security-Policy" in security_snippet
        assert "unsafe-eval" not in security_snippet

        health_status, health_body, health_headers = request_with_headers(port, "/healthz")
        assert (health_status, health_body) == (200, b"ok\n")
        assert_security_headers(health_headers, port=port, context="healthz")

        status, index, index_headers = request_with_headers(port, "/")
        assert status == 200 and b'<div id="root">' in index, "SPA not served"
        assert_security_headers(index_headers, port=port, context="spa")
        assert request(port, "/workspace/smoke?recordId=example") == (200, index)

        missing_status, _missing_body, missing_headers = request_with_headers(
            port, "/assets/does-not-exist.js"
        )
        assert missing_status == 404
        assert_security_headers(missing_headers, port=port, context="static-404")

        sw_status, sw_body, sw_headers = request_with_headers(port, "/sw.js")
        assert sw_status == 200, sw_status
        assert_security_headers(sw_headers, port=port, context="service-worker")
        cache_control = sw_headers.get("Cache-Control", "").lower()
        for directive in ("no-store", "no-cache", "must-revalidate"):
            assert directive in cache_control, (directive, cache_control)
        assert "immutable" not in cache_control, cache_control
        assert sw_headers.get("Service-Worker-Allowed") == "/", sw_headers
        sw_source = sw_body.decode("utf-8")
        assert 'const STATIC_CACHE = "qtable-static-v2"' in sw_source
        assert "const API_CACHE" not in sw_source

        for path in ("/api/smoke?check=1", "/graphql", "/auth/smoke", "/oauth/smoke"):
            payload = b'{"smoke":true}'
            status, body, headers = request_with_headers(port, path, payload)
            assert status == 200, (path, status)
            assert_security_headers(headers, port=port, context=path)
            actual = json.loads(body)
            assert actual == {
                "path": path, "method": "POST", "body": payload.decode(),
                "authorization": "Bearer smoke-test-placeholder",
                "cookie": "smoke=placeholder",
            }, actual

        upstream.shutdown()
        upstream.server_close()
        assert request(port, "/healthz") == (200, b"ok\n")
        assert request(port, "/") == (200, index)
        api_status, _api_body, api_headers = request_with_headers(port, "/api/smoke")
        assert api_status == 502
        assert_security_headers(api_headers, port=port, context="proxy-502")
        print(f"[docker-runtime] OK: {'custom' if custom_port else 'default'} port {port}")
    except Exception:
        print(docker("logs", name, check=False), file=sys.stderr)
        raise
    finally:
        docker("rm", "-f", name, check=False)
        upstream.shutdown()
        upstream.server_close()
        thread.join(timeout=3)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 scripts/check-docker-runtime.py IMAGE")
    check_image(sys.argv[1], 9100, custom_port=False)
    check_image(sys.argv[1], 19100, custom_port=True)
