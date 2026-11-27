"""
REFERENCE receiver (Python, standard library only) for the ASiS gateway's `POST /verify-login`.
Same rules as receiver.ts; contract: RESELLER_INTEGRATION.md section 0. NOT the owner's bot: copy
`create_verify_login_handler` into the bot, call it from the bot's own HTTP route with the RAW
request body (bytes, before any JSON parsing) and the two X-ASiS-* headers, and plug the bot's
customer table into `lookup`.  HTTPS must be provided by the reverse proxy.

    status, body = handle({"x-asis-timestamp": ..., "x-asis-signature": ...}, raw_body_bytes)

Rules enforced: HMAC-SHA256 over "<timestamp>.<raw body>" (constant-time compare), timestamp within
60 s, one use per signature, 5 failed passwords per username per 15 min then 429 (no password
check), wrong password == unknown user (same 401, a dummy hash is burned for unknown names).
Limit: throttle and replay memory live in this process only (not shared between workers/restarts).

Run the demo server:  python3 receiver.py --port 8099 --key <shared key>   (demo user ali / correct-horse)
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Callable, Optional


@dataclass
class Customer:
    customer_id: str
    username: str
    status: str  # "active" | "suspended"
    subscription_url: str
    password_hash: str  # opaque: whatever the bot stores
    allowed_devices: Optional[int] = None
    renewal_url: Optional[str] = None


def sign(api_key: str, timestamp: str, raw_body: bytes) -> str:
    return hmac.new(api_key.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256).hexdigest()


def create_verify_login_handler(
    api_key: str,
    lookup: Callable[[str], Optional[Customer]],
    verify_password: Callable[[str, str], bool],
    burn_password_check: Callable[[str], None],
    now: Callable[[], float] = time.time,
    max_clock_skew_seconds: int = 60,
    max_failures: int = 5,
    failure_window_seconds: float = 15 * 60,
):
    failures: dict[str, tuple[int, float]] = {}
    used_signatures: dict[str, float] = {}
    unauthorized = (401, {"ok": False})

    def failures_for(username: str) -> int:
        entry = failures.get(username)
        if entry is None or now() - entry[1] > failure_window_seconds:
            failures.pop(username, None)
            return 0
        return entry[0]

    def record_failure(username: str) -> None:
        entry = failures.get(username)
        if entry is None or now() - entry[1] > failure_window_seconds:
            failures[username] = (1, now())
        else:
            failures[username] = (entry[0] + 1, entry[1])

    def handle(headers: dict, raw_body: bytes):
        h = {k.lower(): v for k, v in headers.items()}
        timestamp = h.get("x-asis-timestamp") or ""
        provided = h.get("x-asis-signature") or ""
        if not re.fullmatch(r"\d{9,12}", timestamp) or not provided:
            return unauthorized
        if abs(now() - int(timestamp)) > max_clock_skew_seconds:
            return unauthorized
        if not hmac.compare_digest(provided.encode(), sign(api_key, timestamp, raw_body).encode()):
            return unauthorized

        for sig in [s for s, at in used_signatures.items() if now() - at > max_clock_skew_seconds * 2]:
            del used_signatures[sig]
        if provided in used_signatures:
            return unauthorized
        used_signatures[provided] = now()

        try:
            parsed = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return 400, {"ok": False}
        if not isinstance(parsed, dict):
            return unauthorized
        username = parsed.get("username")
        password = parsed.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            return unauthorized
        username = username.strip().lower()
        if not username or len(username) > 64 or not password or len(password) > 128:
            return unauthorized

        if failures_for(username) >= max_failures:
            return 429, {"ok": False}

        customer = lookup(username)
        if customer is None:
            burn_password_check(password)
            record_failure(username)
            return unauthorized
        if not verify_password(password, customer.password_hash):
            record_failure(username)
            return unauthorized
        failures.pop(username, None)

        body = {
            "ok": True,
            "customer_id": customer.customer_id,
            "username": customer.username,
            "status": customer.status,
            "subscription_url": customer.subscription_url,
        }
        if customer.allowed_devices:
            body["allowed_devices"] = customer.allowed_devices
        if customer.renewal_url:
            body["renewal_url"] = customer.renewal_url
        return 200, body

    return handle


# ---- demo only: scrypt helpers and a tiny HTTP server (the real bot uses its own) ----------------
def demo_hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32, maxmem=64 * 1024 * 1024)
    return "scrypt$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(key).decode()


def demo_verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, key_b64 = stored.split("$")
        salt, expected = base64.urlsafe_b64decode(salt_b64), base64.urlsafe_b64decode(key_b64)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32, maxmem=64 * 1024 * 1024)
        return hmac.compare_digest(expected, actual)
    except Exception:
        return False


_DUMMY = demo_hash_password("asis-dummy-password-for-timing")


def demo_burn(password: str) -> None:
    demo_verify_password(password, _DUMMY)


def _serve(port: int, key: str) -> None:
    link = "https://panel.example.com/sub/AbCdEfGhIjKl"
    customers = {
        "ali": Customer("42", "ali", "active", link, demo_hash_password("correct-horse"), allowed_devices=3),
        "sus": Customer("43", "sus", "suspended", link, demo_hash_password("correct-horse")),
    }
    handle = create_verify_login_handler(key, customers.get, demo_verify_password, demo_burn)

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            if self.path != "/asis/verify-login":
                self.send_response(404)
                self.end_headers()
                return
            raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            status, body = handle(
                {"x-asis-timestamp": self.headers.get("X-ASiS-Timestamp"), "x-asis-signature": self.headers.get("X-ASiS-Signature")},
                raw,
            )
            payload = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):  # never log bodies: they carry passwords
            pass

    print(f"listening on {port}", flush=True)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8099)
    ap.add_argument("--key", required=True)
    args = ap.parse_args()
    _serve(args.port, args.key)
