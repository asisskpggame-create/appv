# ASiS VPN

ASiS VPN is a commercial, multi-platform end-user VPN client ecosystem targeting Android, iOS, and Windows, backed by a dedicated client API gateway that integrates with existing PasarGuard VPN management infrastructure and an existing reseller management system.

## Important Boundary & Scope Notice

- **End-User Client Only**: ASiS VPN does **not** rebuild, replace, or duplicate PasarGuard or the existing reseller management panel. Administrative and reseller consoles are strictly out of scope.
- **Google AI Studio Runtime Reality**: The active Google AI Studio environment executes a React + TypeScript web application (`vite`) and can run a Node.js/Express gateway (`server.ts`). Native OS VPN tunnels (`Android VpnService`, iOS `NEPacketTunnelProvider`, Windows `Wintun` + `sing-box` service) **cannot** compile or run inside a browser sandbox and must be built in their respective native toolchains (`Android Studio`, `Xcode`, `Windows SDK / MSVC / MSIX`).
- **No Simulated VPN Tunnels**: The web workspace is used exclusively for design-system verification, bilingual RTL/LTR layout testing, API contract validation, and backend gateway integration—never as a fake VPN tunnel.

## Documentation Index

- `ARCHITECTURE.md` — System topology, runtime separation, and platform native/web boundaries
- `PRODUCT_SPECIFICATION.md` — Commercial product requirements, brand identity, and UX rules
- `API_CONTRACT.md` — Proposed client-to-gateway REST API contract (pending upstream schema confirmation)
- `PASARGUARD_INTEGRATION.md` — Adapter contract and required integration inputs from PasarGuard
- `RESELLER_INTEGRATION.md` — Adapter contract and required integration inputs from the reseller system
- `VPN_ENGINE.md` — Modular VPN engine abstraction (`sing-box` + native platform adapters)
- `SECURITY.md` — Threat model, token lifecycle, secret boundaries, and configuration injection defenses
- `DATABASE_SCHEMA.md` — Gateway & client local storage entity specifications
- `TESTING.md` — Automated & manual QA verification plans per phase and OS
- `ROADMAP.md` — Phased execution plan (Phases 0–10)
- `CHANGELOG.md` — Chronological record of completed phases and changes
- `IMPLEMENTATION_STATUS.md` — Live phase-by-phase verification matrix

## Quick Start (Current Web & Design System Workspace)

```bash
npm install
npm run lint
npm run build
npm run dev
```

The development server runs on `http://localhost:3000`.

### Gateway environment (see `.env.example`)
`ASIS_JWT_SECRET` (32+ chars, required in production), `ASIS_DB_PATH` / `ASIS_DB_KEY` (SQLite store), PasarGuard instance settings, `RESELLER_BASE_URL` + `RESELLER_API_KEY` (optional reseller login), `ADMIN_API_KEY` (32+ chars, enables `/api/v1/admin/*`).
