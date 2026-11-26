# ASiS VPN — Proposed Client API Contract (v1)

> **Status**: Draft Contract (Phase 0 Baseline). Endpoints and schemas are proposed for the ASiS Client API Gateway and will be implemented in Phase 3 once adapter requirements are confirmed.

Base Path: `/api/v1`

## 1. Authentication & Sessions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Exchange username + password + device metadata for short-lived access token & rotating refresh token |
| `POST` | `/auth/refresh` | Refresh Token | Rotate refresh token and issue new access token |
| `POST` | `/auth/logout` | Bearer | Revoke current device session |
| `POST` | `/auth/password-recovery` | Public | Delegate recovery request to existing reseller/panel workflow |

## 2. User & Devices

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/user/me` | Bearer | Retrieve account profile, status (`active`, `suspended`), and active subscription pointer |
| `GET` | `/devices` | Bearer | List registered devices and active sessions |
| `POST` | `/devices/revoke` | Bearer | Revoke a specific device session by `deviceId` |

## 3. Subscriptions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/subscriptions` | Bearer | List account-synchronized and user-registered subscriptions |
| `POST` | `/subscriptions/import` | Bearer | Validate, parse, and register a manual subscription URL/payload (SSRF-guarded) |
| `GET` | `/subscriptions/{id}` | Bearer | Get normalized subscription metadata (traffic, dates, status, allowed devices) |
| `GET` | `/subscriptions/{id}/config` | Bearer | Retrieve sanitized outbound node configs for engine consumption |
| `POST` | `/subscriptions/{id}/refresh` | Bearer | Re-fetch upstream subscription state and configs |
| `DELETE` | `/subscriptions/{id}` | Bearer | Remove a manually imported subscription |

## 4. Servers, Usage, Support & Updates

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/servers` | Bearer | Paginated/filterable server catalog across active subscriptions |
| `GET` | `/servers/{id}` | Bearer | Single server metadata & supported protocols |
| `GET` | `/servers/{id}/ping` | Bearer | Gateway-side TCP/TLS reachability probe (distinct from client tunnel RTT) |
| `GET` | `/usage` | Bearer | Authoritative server-side traffic usage snapshots |
| `GET` | `/app/version` | Public | Minimum supported version, latest version, release notes, mandatory flag, platform URLs |
| `GET` | `/support` | Bearer | Support contact metadata, FAQs, and ticket entry point from backend |

## 5. Standard Error Envelope

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "category": "authentication_failure",
    "message": "Invalid username or password.",
    "diagnosticId": "diag_01J...",
    "recoveryAction": "verify_credentials"
  }
}
```

Every response avoids leaking upstream tokens, internal panel URLs, or raw subscription URLs.
