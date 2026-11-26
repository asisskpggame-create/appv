# PasarGuard Integration Specification

> **Status**: `NOT CONNECTED` — Awaiting real PasarGuard API documentation, version details, and sanitized payload samples from the system owner.

## 1. Architectural Rule

The ASiS VPN mobile/desktop clients **never** communicate directly with PasarGuard admin endpoints or store PasarGuard admin tokens. Only the server-side **ASiS Client API Gateway** communicates with PasarGuard instances through a versioned `PasarGuardAdapter` interface.

## 2. Adapter Responsibilities

1. **Authenticate** with the configured PasarGuard instance(s) using server-side credentials.
2. **Retrieve End-User Record** (account state: active, disabled, expired, limited).
3. **Retrieve Subscription Metadata** (traffic limit, used traffic, expiry timestamp, on-hold rules).
4. **Retrieve Configuration Links / Sub URI** and normalize them into ASiS internal outbound descriptors.
5. **Retrieve Usage Metrics** for authoritative billing/quota display.
6. **Version Compatibility & Error Mapping** to ASiS structured error categories.

## 3. Exact Information Required from Owner Before Live Integration

Please provide the following (sanitized, without live production passwords):
1. **PasarGuard Version** (exact release tag/commit) and base API style (REST / OpenAPI / Marzban-compatible endpoints).
2. **Authentication Mechanism** for user-level vs. service-level queries (OAuth2 password flow `/api/admin/token`, API key header, or dedicated user-portal endpoint).
3. **End-User Login Endpoint**: Does PasarGuard verify end-user username/password directly, or are end-user credentials managed in the Reseller system?
4. **Sample Sanitized JSON Responses** for:
   - User / Subscription object (`username`, `status`, `used_traffic`, `data_limit`, `expire`, `subscription_url`, `inbounds` / `proxies`).
   - Subscription output format (Base64 URI list, Clash/Mihomo YAML, or `sing-box` JSON).
5. **Multi-Instance Topology**: Number of PasarGuard panels, region/instance naming convention, and whether a single user can hold subscriptions across multiple instances.
6. **Rate Limits & Network Rules**: Allowed gateway IP whitelisting and timeout expectations.
