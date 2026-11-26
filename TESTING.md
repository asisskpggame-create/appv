# ASiS VPN — Testing & Quality Assurance Plan

## 1. Automated Verification Levels

1. **Static & Type Safety**: `tsc --noEmit`, ESLint, Kotlin detekt/ktlint, SwiftLint.
2. **Unit Tests**:
   - Protocol URI & JSON parsers (valid, malformed, injection attempts).
   - Subscription deduplication, URL validation, and SSRF blocklists.
   - Token rotation, expiry, and revocation logic.
   - Bilingual formatting (`fa-IR` RTL + `en-US` LTR) and tabular data rendering.
3. **Gateway Integration Tests**:
   - Contract validation against OpenAPI schema (`API_CONTRACT.md`).
   - Adapter error mapping for PasarGuard and Reseller failures (timeouts, 401, 429, suspended account).
4. **Native OS VPN Integration Tests (Device / VM Required)**:
   - Android: `VpnService` permission grant, TUN establishment, Wi-Fi <-> 5G handoff, Kill Switch verification.
   - iOS: `NEPacketTunnelProvider` startup, memory cap (`<= 50MB` extension limit), On-Demand rules.
   - Windows: `Wintun` interface lifecycle, elevated service IPC, DNS leak test, IPv6 leak test.

## 2. Mandatory Manual QA Scenarios

- [ ] Login success, invalid credentials, suspended account, offline error
- [ ] Refresh token rotation & remote device revocation
- [ ] Account subscription sync vs. manual URL / QR / file import & duplicate check
- [ ] Expired subscription & traffic exhaustion handling
- [ ] Real tunnel establishment + public IP change + DNS leak verification per OS
- [ ] Persian (`fa-IR`) complete RTL visual inspection on every screen
- [ ] Light & Dark theme contrast audit (WCAG AA)

> **Rule**: A green web build or UI preview is never accepted as proof of a functioning VPN tunnel.
