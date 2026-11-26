# ASiS VPN — System Architecture

## 1. High-Level Topology

```
+-------------------------------------------------------------------+
|                     End-User Native Clients                       |
|  Android (Kotlin + Compose)  |  iOS (Swift + SwiftUI)  |  Windows |
|  [VpnService + sing-box]     |  [NetworkExtension]     |  [Wintun]|
+------------------------------+-------------------------+----------+
                               | HTTPS (TLS 1.3) + Bearer JWT
                               v
+-------------------------------------------------------------------+
|               ASiS Client API Gateway (Backend)                   |
|  - Auth & Session Broker (Access / Refresh Rotation, Devices)     |
|  - Subscription Normalizer (Account + Manual Import Parser)       |
|  - Server Catalog & Health Aggregator                             |
|  - App Version & Support Metadata                                 |
+------------------------------+-------------------------+----------+
                               |                         |
            Private Server-to-Server APIs (Never exposed to clients)
                               |                         |
                               v                         v
              +------------------------+   +------------------------+
              |  PasarGuard Adapter    |   |   Reseller Adapter     |
              |  (Multi-instance ready)|   |  (Customer & Billing)  |
              +------------+-----------+   +------------+-----------+
                           |                            |
                           v                            v
                [Existing PasarGuard]       [Existing Reseller Panel]
                [Existing VPN Nodes]
```

## 2. Feasibility Split: Google AI Studio vs. Native Toolchains

### Implementable Directly in Google AI Studio
1. **Shared Design System & Bilingual Web Reference UI (`src/design-system/`)**:
   - Exact ASiS VPN tokens (`#087BFF`, `#EAF3FF`, `#FFFFFF`, `#0E1428`, `#64748B`, `#1684FF`), light/dark themes, and complete `fa-IR` (RTL) + `en-US` (LTR) support.
   - Interactive UI flows for authentication, subscription management, server catalog filtering, traffic statistics views, settings, and diagnostics—strictly labeled with real connection/integration state (`NOT CONNECTED` / `DEMO FIXTURE` until upstream APIs are wired).
2. **Client API Gateway Prototype (`server.ts` Express + TypeScript)**:
   - Implements the documented `/api/v1/*` contract, request validation, token rotation, rate limiting, SSRF-safe subscription URL fetching, and modular PasarGuard + Reseller adapter interfaces.
   - Note: While the production target backend stack specifies **Python + FastAPI + PostgreSQL + Redis**, an Express + TypeScript gateway inside AI Studio allows live end-to-end API contract testing immediately, alongside an exportable FastAPI reference specification.
3. **Configuration Parsers & Validation Engines (TypeScript)**:
   - Strict URI/JSON parsers and injection validators for VLESS (`Reality`/`TLS`), VMess, Trojan, Shadowsocks, WireGuard, Hysteria2, and TUIC subscription links, testable directly in Node/Vitest.

### Requires Native Development Environments
1. **Android (`native/android/`)**:
   - Requires Android Studio, Android Gradle Plugin, Kotlin, Jetpack Compose, `android.net.VpnService`, and `libbox` (Go-compiled `sing-box` AAR via `gomobile`) to establish real TUN interfaces and per-app split tunneling.
2. **iOS (`native/ios/`)**:
   - Requires macOS + Xcode, Apple Developer entitlements (`NetworkExtension`, `Personal VPN`, `App Groups`), Swift/SwiftUI, `NEPacketTunnelProvider`, and `Libbox.xcframework`.
3. **Windows (`native/windows/`)**:
   - Requires Windows SDK / Visual Studio, elevated Windows Service or WinUI 3 / WPF shell, `Wintun` virtual adapter driver, `sing-box` core binary, and Windows Filtering Platform (WFP) rules for Kill Switch.

## 3. Multi-Instance PasarGuard Support

Every subscription and server entity carries an immutable `providerInstanceId` (e.g., `pg-eu-01`, `pg-asia-02`). The gateway routes user lookups, usage queries, and config fetches through an adapter registry keyed by `providerInstanceId`, allowing horizontal scaling across multiple PasarGuard panels without client changes.
