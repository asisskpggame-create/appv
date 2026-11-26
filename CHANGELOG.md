# Changelog

## [1.0.0-rc.1] - 2026-11-26 — Phases 6–10 (Complete End-User Client, Engine Abstraction, Native Modules & QA)

### Added
- **Phase 6 (`src/engine/`)**: Unified `VpnEngineAdapter` interface, strict protocol URI/JSON parser & injection blocker (`VLESS+Reality/TLS`, `VMess`, `Trojan`, `Shadowsocks`, `WireGuard`, `Hysteria2`, `TUIC`, `SOCKS`, `HTTP Proxy`), explicit `UNSUPPORTED` markers (`OpenVPN`, `IKEv2`), and `AsisVpnEngineAdapter` with native bridge delegation + honest browser error state.
- **Phase 7 (`native/`)**: Documented native platform VPN source modules (`native/android/AsisVpnService.kt`, `native/ios/PacketTunnelProvider.swift`, `native/windows/AsisWindowsVpnEngine.cs`) and platform build guides.
- **Phase 8–9 (`src/client/AsisClientShell.tsx`, `src/features/home/`, `statistics/`, `account/`, `settings/`, `support/`)**: Full end-user ASiS VPN client shell with Home Connect screen, Locations, Subscriptions, Statistics (local vs. authoritative server usage + protocol matrix), Account & Device Management, platform-gated Advanced Settings + Update Checker, and Redacted Diagnostics + Support.
- **Phase 10 (`tests/runTests.ts`)**: Automated test suite verifying protocol parsing, injection defense, SSRF protection, JWT signing/rotation, and Smart Selection.

## [0.5.0] - 2026-11-26 — Phase 5 (Server Catalog & Smart Selection)

### Added
- `src/features/servers/`:
  - `serverCatalogUtils.ts`: Derives server entries directly from real account/imported subscriptions, extracts unambiguous country metadata, excludes unsupported protocols, and evaluates Smart Selection policies (`automatic`, `lowest_latency`, `specific_country`, `specific_server`, `favorite_server`) without inventing fake latency or capacity.
  - `ServersView.tsx`: Search, country/protocol filtering, latency/name sorting, favorites, recent servers strip, and Smart Selection diagnostic output with honest `Unavailable` ping markers in browser preview.
  - `serverTranslations.ts`: Bilingual `en-US` (LTR) and `fa-IR` (RTL) localization.

## [0.4.0] - 2026-11-26 — Phase 4 (Subscriptions & Manual Import)

### Added
- `src/features/subscriptions/`:
  - `subscriptionParser.ts`: Strict HTTPS/host validation, SHA-256 duplicate fingerprinting, redacted host parsing for `vless://`, `vmess://`, `trojan://`, `ss://`, `hysteria2://`, `hy2://`, `tuic://`, `wg://`, `socks://`, `sing-box` JSON outbounds, WireGuard `.conf`, and `Subscription-Userinfo` header parsing.
  - `SubscriptionsView.tsx`: Account sync status view (honest `NOT CONNECTED` until PasarGuard/Reseller schemas are configured) plus full Manual Subscription Import via HTTPS URL, Clipboard paste, QR image decode (`BarcodeDetector` where browser-supported), and Config File upload (`.txt`, `.json`, `.conf`), with duplicate blocking, refresh, delete confirmation, and active selection.
  - `subscriptionTranslations.ts`: Bilingual `en-US` (LTR) and `fa-IR` (RTL) coverage.

## [0.3.0] - 2026-11-26 — Phase 3 (Backend API Gateway & Integration Adapters)

### Added
- `server.ts`: Express + Vite full-stack server on port `3000` mounting `/api/v1` gateway routes.
- `src/gateway/`:
  - `router.ts`: All `/api/v1/*` contract endpoints (Auth, Devices, Subscriptions + SSRF-safe import, Servers, Usage, Updates, Support, Health) with Bearer auth middleware, device revocation checks, and sliding-window rate limiting.
  - `security.ts`: HS256 JWT access token signing/verification (`crypto.randomBytes` fallback when `ASIS_JWT_SECRET` unset), SHA-256 secret hashing, and strict SSRF URL validation blocking loopback/private/metadata IPs.
  - `adapters/pasarguardAdapter.ts`: Multi-instance `PasarGuardAdapterRegistry` + `NotConnectedPasarGuardAdapter` + `HttpPasarGuardAdapter` skeleton.
  - `adapters/resellerAdapter.ts`: `ResellerAdapter` + `NotConnectedResellerAdapter` + `HttpResellerAdapter` skeleton.
  - `adapters/gatewayStore.ts`: Rotating refresh token families with reuse detection, device tracking, and imported subscription deduplication.
  - `openapi.ts`: Live OpenAPI 3.1.0 specification served at `/api/v1/openapi.json`.
- `src/features/gateway/GatewayStatusView.tsx`: Live gateway health, adapter readiness, and OpenAPI contract inspector.

## [0.2.0] - 2026-11-26 — Phase 2 (Authentication UI & Session Handling)

### Added
- `src/features/auth/` module implementing the ASiS VPN Authentication component:
  - `AuthForm.tsx`: Username & password login form with real-time/submit validation, password visibility toggle, loading state (`Button loading`), password recovery modal workflow, structured error display with error codes & diagnostic IDs, and QA error state previewer (`invalid`, `suspended`, `expired`, `network`).
  - `sessionStore.ts`: Memory-only `InMemorySessionStorage` adapter (never persisting tokens to `localStorage`/`sessionStorage`) and token expiry helpers.
  - `authClient.ts`: `HttpAuthClient` targeting `/api/v1/auth/*` with honest `GATEWAY_NOT_CONNECTED` handling prior to Phase 3 backend wiring.
  - `authTranslations.ts`: Complete `en-US` (LTR) and `fa-IR` (RTL) localization for all authentication states.

## [0.1.0] - 2026-11-26 — Phase 0 & Phase 1

### Added
- Complete Phase 0 architectural analysis and 13-file commercial documentation suite (`README.md`, `ARCHITECTURE.md`, `PRODUCT_SPECIFICATION.md`, `API_CONTRACT.md`, `PASARGUARD_INTEGRATION.md`, `RESELLER_INTEGRATION.md`, `VPN_ENGINE.md`, `SECURITY.md`, `DATABASE_SCHEMA.md`, `TESTING.md`, `ROADMAP.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`).
- Phase 1 ASiS VPN Design System under `src/design-system/`:
  - Brand color tokens (`#087BFF`, `#EAF3FF`, `#FFFFFF`, `#0E1428`, `#64748B`, `#1684FF`) and Tailwind v4 `@custom-variant dark` dual-theme configuration.
  - Bilingual `en-US` (LTR) and `fa-IR` (RTL) localization provider with `Plus Jakarta Sans`, `Vazirmatn`, and `JetBrains Mono` typography.
  - Reusable commercial UI components: `BrandLogo`, `Button`, `Card`, `Input`, `SegmentedControl`, `StatusBanner`, `Dialog`, `Skeleton`, `EmptyState`, `ErrorState`.
  - Phase 1 Design System & Architecture Verification Workbench in `src/App.tsx`.
