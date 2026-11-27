# ASiS VPN — Phased Implementation Roadmap

> The "Pending" labels below are the original plan. For what is actually built and verified, read `IMPLEMENTATION_STATUS.md` and `CHANGELOG.md` (steps 0.3.6 - 0.4.2 came after Phase 10).

- **Phase 0 — Architecture & Specification Analysis** *(Completed in Turn 1)*
  - Requirement analysis, runtime feasibility split, documentation suite, and integration prerequisites.
- **Phase 1 — Project Structure & Design System** *(Completed in Turn 1)*
  - Brand tokens (`#087BFF`, `#EAF3FF`, `#FFFFFF`, `#0E1428`, `#64748B`, `#1684FF`), Light/Dark dual theme, `fa-IR` RTL / `en-US` LTR bilingual engine, reusable UI primitives, and Phase 1 Design System Workbench.
- **Phase 2 — Authentication & Local Session Handling** *(Pending Approval)*
  - Login UI, password visibility, token rotation memory/secure storage patterns, session expiry & revocation states, and backend `/auth/*` endpoints.
- **Phase 3 — Backend API Contracts & Integration Adapters** *(Pending Approval & Upstream Docs)*
  - Full Express/TS gateway (`/api/v1/*`), OpenAPI spec, `PasarGuardAdapter` + `ResellerAdapter` interfaces with explicit `NOT CONNECTED` / `DEV FIXTURE` labeling.
- **Phase 4 — Account Subscriptions & Manual Import** *(Pending)*
  - Account sync view, URL/clipboard/QR/file import, validation, duplicate detection, and traffic/expiry breakdown.
- **Phase 5 — Server Catalog & Smart Selection** *(Pending)*
  - Search, country/protocol filters, favorites, recents, and real reachability probing.
- **Phase 6 — VPN Engine Abstraction & Protocol Parsers** *(Pending)*
  - `VpnEngineAdapter` TypeScript & native interfaces, strict URI parsers (`VLESS`, `VMess`, `Trojan`, `SS`, `WG`, `Hysteria2`, `TUIC`), and unsupported protocol gating.
- **Phase 7 — Native Platform VPN Integration Modules** *(Pending)*
  - Documented Android (`VpnService` + `libbox`), iOS (`NEPacketTunnelProvider`), and Windows (`Wintun` + `sing-box` service) source skeletons and build guides.
- **Phase 8 — Connection Monitoring & Authoritative Statistics** *(Pending)*
  - Local engine stats vs. server-side authoritative subscription usage charts and session history.
- **Phase 9 — Advanced Settings & Support / Updates** *(Pending)*
  - Platform-gated Kill Switch, Split Tunneling, DNS, IPv4/IPv6, MTU, update checks, and diagnostics export.
- **Phase 10 — Security Hardening, Testing & Release Readiness** *(Pending)*
  - Security audit, end-to-end automated tests, and native release checklists.
