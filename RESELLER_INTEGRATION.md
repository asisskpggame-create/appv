# Existing Reseller System Integration Specification

> **Status**: `NOT CONNECTED` — Awaiting Reseller API documentation and sanitized response schemas from the system owner.

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
