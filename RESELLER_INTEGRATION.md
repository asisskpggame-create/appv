# Existing Reseller System Integration Specification

> **Status**: password login contract (`POST /verify-login`) implemented gateway-side; profile, purchased services and password recovery still pending. See section 0.

## 0. Password login contract (implemented in the gateway)

PasarGuard users have no password, so the **reseller system** (e.g. the sales bot) is the only thing that verifies one. It keeps a hash of an app-specific password per customer (argon2/bcrypt; never the panel or Telegram credentials).

Gateway config: `RESELLER_BASE_URL` (e.g. `https://bot.example.com/asis`) and `RESELLER_API_KEY` (shared secret).

Request: `POST {RESELLER_BASE_URL}/verify-login`
- Headers: `Content-Type: application/json`, `X-ASiS-Timestamp: <unix seconds>`, `X-ASiS-Signature: hex(HMAC-SHA256(RESELLER_API_KEY, "<timestamp>.<raw body>"))`
- Body: `{"username": "...", "password": "...", "nonce": "<32 hex chars, new per request>"}` (receivers may ignore `nonce`; it only keeps each signature unique so replay protection does not reject two real logins in the same second)
- The receiver MUST recompute the signature over the raw body, compare in constant time and reject timestamps older than ~60 s. Use HTTPS only.

Response `200`: `{"ok": true, "customer_id": "42", "username": "ali", "status": "active" | "suspended", "subscription_url": "https://panel/sub/<token>", "allowed_devices": 3, "renewal_url": "https://..."}`
- `username` and `subscription_url` are required. `subscription_url` must belong to a PasarGuard instance configured in the gateway; the gateway then treats the user exactly like a link login (servers, usage, configs come from the panel).
- Wrong username or password: HTTP `401` (or `{"ok": false}`); too many attempts: `429`. Do not say which of the two was wrong.
- Anything else (timeout 8 s, 5xx, malformed JSON) is reported to the app as `RESELLER_UPSTREAM_UNAVAILABLE`, never as a login.

## 1. Architectural Rule

ASiS VPN does **not** build a reseller portal or expose reseller privileges. The `ResellerAdapter` lives exclusively inside the ASiS Client API Gateway to synchronize customer identity, purchased plans, and renewal links/status.

## 2. Adapter Responsibilities

1. **Approved Service Authentication** between ASiS Client Gateway and the Reseller backend.
2. **Customer Account Lookup** (mapping ASiS username/account ID to reseller customer record).
3. **Purchased Services & Subscriptions** (listing active, pending, expired, and trial services).
4. **Renewal Information Sync** (grace periods, renewal URL or order reference when supported).
5. **Password Recovery Delegation** (triggering or linking to the existing reseller password reset workflow).

## 3. Exact Information Required from Owner Before Live Integration

Please provide the following (sanitized):
1. **Reseller System Stack & API Docs** (REST/GraphQL endpoints, auth scheme such as HMAC signature, Bearer token, or mTLS).
2. **Source of Truth for User Login**: Are end-user usernames and passwords authenticated against the Reseller database, PasarGuard, or an existing SSO/identity store?
3. **Sample Sanitized Payloads** for:
   - Customer profile & account suspension state.
   - Purchased VPN services list and mapping key to PasarGuard username/UUID.
   - Renewal metadata and allowed device limits.
4. **Password Recovery Endpoint / URL**: How users currently reset forgotten passwords so the client can invoke the exact approved workflow.
5. **Webhook / Sync Cadence**: Whether the reseller system pushes status updates via webhooks or requires gateway polling with short TTL caching.
