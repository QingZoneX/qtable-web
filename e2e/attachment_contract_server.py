from __future__ import annotations

import json
import re
from email.parser import BytesParser
from email.policy import default
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 9000
PASSWORD = None
TABLE_ID = "tbl-attachment-browser-e2e"
RECORD_ID = "record-attachment-browser-e2e"
FIELD_ID = "files"
ALICE_ID = "927101"
BOB_ID = "927102"
MANAGER_ID = "927103"
EMAIL_TO_ID = {
    "attachment-e2e-alice@example.test": ALICE_ID,
    "attachment-e2e-bob@example.test": BOB_ID,
    "attachment-e2e-manager@example.test": MANAGER_ID,
}

state = {
    "owner": ALICE_ID,
    "attachment": None,
    "payload": b"",
    "recycled": False,
    "purged": False,
}


def json_bytes(value) -> bytes:
    return json.dumps(value).encode("utf-8")


def parse_multipart(content_type: str, body: bytes):
    message = BytesParser(policy=default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode()
        + body
    )
    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") != "file":
            continue
        filename = part.get_filename() or "attachment.bin"
        payload = part.get_payload(decode=True) or b""
        return filename, part.get_content_type(), payload
    raise ValueError("file part missing")


class Handler(BaseHTTPRequestHandler):
    server_version = "QTableAttachmentContract/1.0"

    def log_message(self, format, *args):
        print(f"[contract-server] {self.address_string()} {format % args}")

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or 0)
        return self.rfile.read(length) if length else b""

    def _send(self, status: int, body: bytes = b"", content_type: str = "application/json", **headers):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for name, value in headers.items():
            self.send_header(name.replace("_", "-"), value)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _json(self, status: int, value, **headers):
        self._send(status, json_bytes(value), **headers)

    def _actor_id(self):
        auth = self.headers.get("Authorization", "")
        match = re.fullmatch(r"Bearer contract-(\d+)", auth)
        return match.group(1) if match else None

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            self._send(200, b"ok\n", "text/plain")
            return
        if path == "/__test__/state":
            self._json(200, {k: v for k, v in state.items() if k != "payload"})
            return
        if path.startswith("/api/attachments/"):
            attachment = state["attachment"]
            requested = path.rsplit("/", 1)[-1]
            actor = self._actor_id()
            allowed = actor in {state["owner"], MANAGER_ID}
            if (
                not attachment
                or requested != attachment["attachmentId"]
                or state["recycled"]
                or state["purged"]
                or not allowed
            ):
                self._json(HTTPStatus.NOT_FOUND, {"detail": "Attachment not found"})
                return
            self._send(
                200,
                state["payload"],
                attachment["contentType"],
                Cache_Control="private, no-store",
            )
            return
        self._json(404, {"detail": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_body()
        if path == "/auth/login":
            payload = json.loads(body or b"{}")
            actor_id = EMAIL_TO_ID.get(str(payload.get("email") or ""))
            if not actor_id:
                self._json(401, {"detail": "Invalid credentials"})
                return
            self._json(
                200,
                {
                    "access_token": f"contract-{actor_id}",
                    "refresh_token": f"contract-refresh-{actor_id}",
                },
            )
            return

        if path == "/graphql":
            payload = json.loads(body or b"{}")
            query = str(payload.get("query") or "")
            variables = payload.get("variables") or {}
            actor = self._actor_id()
            if not actor:
                self._json(200, {"data": None, "errors": [{"message": "Unauthorized"}]})
                return

            if "recordById" in query:
                if state["recycled"] or state["purged"] or actor not in {state["owner"], MANAGER_ID}:
                    self._json(200, {"data": None, "errors": [{"message": "Record not found or no access"}]})
                    return
                record = {"id": RECORD_ID, "owner": [state["owner"]], FIELD_ID: []}
                if state["attachment"]:
                    record[FIELD_ID] = [state["attachment"]]
                self._json(200, {"data": {"recordById": record}})
                return

            if "UpdateRecord" in query:
                if actor != state["owner"]:
                    self._json(200, {"data": None, "errors": [{"message": "No update access"}]})
                    return
                value = variables.get("value") or []
                state["owner"] = str(value[0])
                self._json(200, {"data": {"updateRecord": {"id": RECORD_ID, "owner": value}}})
                return

            if "DeleteRecord" in query:
                if actor not in {state["owner"], MANAGER_ID} or state["purged"]:
                    self._json(200, {"data": None, "errors": [{"message": "No delete access"}]})
                    return
                state["recycled"] = True
                self._json(200, {"data": {"deleteRecord": True}})
                return

            if "RecycleBin" in query:
                if actor != MANAGER_ID:
                    self._json(200, {"data": None, "errors": [{"message": "No manage access"}]})
                    return
                items = [] if not state["recycled"] or state["purged"] else [{"recordId": RECORD_ID}]
                self._json(200, {"data": {"recycleBin": {"items": items}}})
                return

            if "RestoreRecord" in query:
                if actor != MANAGER_ID or not state["recycled"] or state["purged"]:
                    self._json(200, {"data": None, "errors": [{"message": "Not restorable"}]})
                    return
                state["recycled"] = False
                self._json(200, {"data": {"restoreRecord": {"recordId": RECORD_ID}}})
                return

            if "PurgeRecord" in query:
                if actor != MANAGER_ID or not state["recycled"]:
                    self._json(200, {"data": None, "errors": [{"message": "Not purgeable"}]})
                    return
                state["purged"] = True
                self._json(200, {"data": {"purgeRecord": True}})
                return

            self._json(200, {"data": None, "errors": [{"message": "Unsupported operation"}]})
            return

        match = re.fullmatch(
            rf"/api/attachments/tables/{TABLE_ID}/records/{RECORD_ID}/fields/{FIELD_ID}",
            path,
        )
        if match:
            actor = self._actor_id()
            if actor != state["owner"] or state["recycled"] or state["purged"]:
                self._json(404, {"detail": "Record not found or no access"})
                return
            try:
                filename, content_type, file_payload = parse_multipart(
                    self.headers.get("Content-Type", ""), body
                )
            except ValueError as exc:
                self._json(400, {"detail": str(exc)})
                return
            attachment = {
                "attachmentId": "att-browser-contract-1",
                "objectKey": f"attachments/{TABLE_ID}/{RECORD_ID}/{FIELD_ID}/att-browser-contract-1",
                "name": filename,
                "size": len(file_payload),
                "contentType": content_type,
            }
            state["attachment"] = attachment
            state["payload"] = file_payload
            self._json(200, {"attachment": attachment, "attachments": [attachment]})
            return

        self._json(404, {"detail": "Not found"})


if __name__ == "__main__":
    print(f"[contract-server] listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
