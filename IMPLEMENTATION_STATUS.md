# Implementation Status

Last Updated: 2026-11-27 (0.4.12)

| Phase | Scope | Status | Honest Runtime Notes |
|---|---|---|---|
| Phase 0 | Requirements & Architecture | Completed | Documented AI Studio vs. native Android/iOS/Windows split and PasarGuard/Reseller prerequisites |
| Phase 1 | Project Structure & Design System | Completed | Bilingual RTL/LTR, Light/Dark, brand tokens, and core UI primitives verified in web build |
| Phase 2 | Auth & Session Handling | Client + Gateway Routes Ready | `AuthForm` + `/api/v1/auth/*` routes wired; awaiting upstream Reseller/PasarGuard credentials |
| Phase 3 | Backend API & Adapters | Gateway & Adapters Ready | Express `/api/v1/*` + OpenAPI 3.1 + `PasarGuardAdapterRegistry` & `ResellerAdapter` (`NOT CONNECTED` until docs supplied) |
| Phase 4 | Subscriptions & Import | Manual Import + Account Sync UI Ready | URL/Clipboard/QR/File import, SHA-256 deduplication, and protocol parser ready; account sync awaits Phase 3 credentials |
| Phase 5 | Server Catalog | Completed | Search, filters, favorites, recents, and Smart Selection diagnostics ready; live probes await gateway/native engines |
| Phase 6 | VPN Engine Abstraction | Completed | `VpnEngineAdapter`, `PROTOCOL_SUPPORT_MATRIX`, injection-safe parser, and native bridge adapter verified |
| Phase 7 | Native Platform Modules | Source Modules Ready | Android (`VpnService`), iOS (`NEPacketTunnelProvider`), Windows (`Wintun` + `sing-box`) source & guides generated; requires native toolchains to compile |
| Phase 8 | Connection Monitoring & Stats | Completed | Home Connect screen, real IP check, local vs authoritative server usage split, and protocol matrix |
| Phase 9 | Advanced Settings & Support | Completed | Platform-gated advanced settings, update check, redacted diagnostics, and FAQs |
| Phase 10 | QA, Security & Release | Web & Gateway Verified | Automated unit tests (`npm test`), `tsc --noEmit`, and `vite build` pass; native OS tunnel QA requires device builds |

## External Integration Readiness

- **PasarGuard Panel**: subscription-link path **implemented** (`/sub/{token}` + `/sub/{token}/info`, Marzban-compatible; link login, usage, server list). The admin API (`getUserRecord`) is still `SCHEMA_PENDING`.
- **Gateway-held accounts**: implemented (0.4.2): scrypt password hashes, 3-strike lock, admin unlock API. Password login ends in the same link pipeline as link login.
- **Reseller System**: `POST /verify-login` client implemented (0.4.1, HMAC-signed) as an optional fallback; profile, purchased services and password recovery are still `SCHEMA_PENDING`. The server side of `/verify-login` (sales bot) does not exist in this repo; 0.4.7 adds a tested reference receiver in `reference/verify-login-receiver/` to copy from.
- **Native VPN Engines**: `NOT APPLICABLE IN BROWSER` (native source modules planned in Phase 7)

## Phase 7 (Android): native bridge (0.3.5)
- Done and unit-tested: link -> sing-box outbound, sing-box config builder, `window.AsisNativeBridge` installer, in-memory link store.
- Written but not compiled or run here: Java plugin/service, libbox engine, CI steps. Verify in the CI log and on a device. See `native/android/README.md`.
- iOS and Windows engines are still skeletons.

## Client/gateway steps after the roadmap (0.3.6 - 0.4.2)
- Done in code and unit-tested: tunnel vs exit routes (0.3.6), real exit IP check (0.3.7), phone-side TCP ping (0.3.8), urltest auto-switch + tunnel latency (0.3.9), auto-connect on open (0.4.0), reseller password login contract (0.4.1), gateway accounts + lock + admin API (0.4.2).
- Not verified on a device: urltest timings and the clash_api endpoints, auto-connect, tcpProbe. Java changes have not been compiled yet; the first CI build is the first real compile.
- 0.4.3: `router.ts` login wiring and `adminRoutes.ts` are now covered by `tests/gatewayHttpTests.ts` (real HTTP, fake panel). `tsc --noEmit` and the full `npm test` were run. 0.4.4 adds `tests/gatewayFlowTests.ts` (reseller fallback, refresh, logout). Still not covered: `vite build`, Android CI, device runs.

- 0.4.5: `npm install` (plain), `tsc --noEmit`, `vite build` and `npm test` (62/62) were all run and pass after fixing two dependency problems (esbuild peer conflict, missing `react-is`). Still not run: Android CI, device.
- 0.4.6: the lock answer is tested end to end up to the client error object (`tests/authClientLockTests.ts`). The `AuthForm` render is not tested.
- 0.4.7: reference `/verify-login` receiver + round-trip tests against the real `HttpResellerAdapter`. The real bot, password setup/change in the bot, profile, purchased services and recovery are still open.
- 0.4.8: Vite config no longer uses `__dirname`; the CI web-install steps (`npm install`, Capacitor `--no-save` install) were run locally and pass. Android build steps are still unverified.
- 0.4.9: vendor chunk split in the Vite config. Served and syntax-checked here, not opened in a browser.
- 0.4.10: Python reference receiver for `/verify-login` + tests (unit tests and a TS-adapter-vs-Python round trip). Not wired into the real bot.
- 0.4.11: signed `/verify-login` body includes a per-request `nonce` (double-tap safe with replay protection).
- 0.4.12: five less-used screens load on demand (charts library no longer in the first download). Built and unit-checked with jsdom once; not run in a real browser.
