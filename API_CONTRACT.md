# ASiS VPN — Proposed Client API Contract (v1)

> **Status**: Draft Contract (Phase 0 Baseline). Endpoints and schemas are proposed for the ASiS Client API Gateway and will be implemented in Phase 3 once adapter requirements are confirmed.

Base Path: `/api/v1`

## 1. Authentication & Sessions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Exchange username + password + device metadata for short-lived access token & rotating refresh token |
| `POST` | `/auth/login-link` | Public | Exchange a PasarGuard subscription link + device metadata for the same token pair (no password); the link must match a configured instance |
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


## 6. Admin endpoints (operator only)

Disabled (404) unless `ADMIN_API_KEY` (>= 32 chars) is set. Send it as `X-Admin-Key`. Do not expose `/api/v1/admin/*` publicly.

| Method | Path | Purpose |
| --- | --- | --- |
| `PUT` | `/admin/accounts/:username` | Body `{password (8-128), subscriptionUrl}`. Creates the account or replaces its password/link; clears any lock. `201` new, `200` updated. |
| `GET` | `/admin/accounts/:username` | `{username, locked, failedAttempts, lockedAt, lastLoginAt, createdAt, updatedAt}` |
| `POST` | `/admin/accounts/:username/unlock` | Clears the 3-strike lock. Optional body `{newPassword}` for a forgotten password. |
| `DELETE` | `/admin/accounts/:username` | Removes the account (`204`). |

Login lock: `POST /auth/login` answers `423 AUTH_ACCOUNT_LOCKED` once an account has had 3 wrong passwords; it stays locked (even for the right password) until an admin unlocks it.
