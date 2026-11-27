import json
import time
import unittest

from receiver import Customer, create_verify_login_handler, demo_burn, demo_hash_password, demo_verify_password, sign

KEY = "k" * 40
LINK = "https://panel.example.com/sub/AbCdEfGhIjKl"


class Clock:
    t = 1_800_000_000.0

    def __call__(self):
        return self.t


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.customers = {"ali": Customer("42", "ali", "active", LINK, demo_hash_password("correct-horse"), allowed_devices=3)}
        self.lookups = 0

        def lookup(u):
            self.lookups += 1
            return self.customers.get(u)

        self.handle = create_verify_login_handler(KEY, lookup, demo_verify_password, demo_burn, now=self.clock, failure_window_seconds=900)

    def call(self, username, password, key=KEY, ts=None):
        raw = json.dumps({"username": username, "password": password}).encode()
        ts = str(int(self.clock.t)) if ts is None else ts
        return self.handle({"X-ASiS-Timestamp": ts, "X-ASiS-Signature": sign(key, ts, raw)}, raw)

    def test_good_login(self):
        status, body = self.call("Ali", "correct-horse")
        self.assertEqual(status, 200)
        self.assertEqual((body["username"], body["customer_id"], body["allowed_devices"], body["subscription_url"]), ("ali", "42", 3, LINK))

    def test_wrong_password_and_unknown_user_are_identical(self):
        self.assertEqual(self.call("ali", "wrong-pass-1"), (401, {"ok": False}))
        self.assertEqual(self.call("ghost", "wrong-pass-1"), (401, {"ok": False}))

    def test_bad_signature_old_timestamp_missing_headers(self):
        self.assertEqual(self.call("ali", "correct-horse", key="x" * 40)[0], 401)
        self.assertEqual(self.call("ali", "correct-horse", ts=str(int(self.clock.t) - 600))[0], 401)
        self.assertEqual(self.handle({}, b"{}")[0], 401)
        self.assertEqual(self.lookups, 0)

    def test_tampered_body(self):
        raw = json.dumps({"username": "ali", "password": "correct-horse"}).encode()
        ts = str(int(self.clock.t))
        status, _ = self.handle({"x-asis-timestamp": ts, "x-asis-signature": sign(KEY, ts, raw)}, raw.replace(b"ali", b"bob"))
        self.assertEqual(status, 401)

    def test_replay(self):
        raw = json.dumps({"username": "ali", "password": "correct-horse"}).encode()
        ts = str(int(self.clock.t))
        headers = {"x-asis-timestamp": ts, "x-asis-signature": sign(KEY, ts, raw)}
        self.assertEqual(self.handle(headers, raw)[0], 200)
        self.assertEqual(self.handle(headers, raw)[0], 401)
        self.assertEqual(self.lookups, 1)

    def test_throttle_then_reset(self):
        for i in range(5):
            self.assertEqual(self.call("ali", f"wrong-pass-{i}")[0], 401)
        before = self.lookups
        self.assertEqual(self.call("ali", "correct-horse")[0], 429)
        self.assertEqual(self.lookups, before)
        self.clock.t += 901
        self.assertEqual(self.call("ali", "correct-horse")[0], 200)

    def test_malformed_json_and_types(self):
        ts = str(int(self.clock.t))
        raw = b"not json"
        self.assertEqual(self.handle({"x-asis-timestamp": ts, "x-asis-signature": sign(KEY, ts, raw)}, raw)[0], 400)
        raw2 = json.dumps({"username": 5, "password": ["x"]}).encode()
        self.assertEqual(self.handle({"x-asis-timestamp": ts, "x-asis-signature": sign(KEY, ts, raw2)}, raw2)[0], 401)


if __name__ == "__main__":
    unittest.main()
