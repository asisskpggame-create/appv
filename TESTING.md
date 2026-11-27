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

### Current automated suites (`npm test`)
- `tests/runTests.ts`: auth validation, protocol validator, SSRF guard, JWT/refresh reuse, gateway routes, link login (needs `express`).
- `tests/engineTests.ts`: sing-box config, native bridge, auto-connect rules.
- `tests/resellerTests.ts`: reseller `/verify-login` client (signature, mapping, error cases).
- `tests/accountTests.ts`: password hashing, 3-strike lock, unlock, parallel guesses (in-memory and SQLite).
- Gap: router wiring of the login paths and `/admin/*` have no HTTP-level test yet.

- One command for the baseline: `npm run check` (runs `scripts/check.sh`: install if needed, `tsc --noEmit`, `npm test`, `vite build`; stops at the first failure).

## 2. Mandatory Manual QA Scenarios

- [ ] Login success, invalid credentials, suspended account, offline error
- [ ] 3 wrong passwords -> locked; right password still refused; admin unlock (and unlock with new password) works
- [ ] Auto-connect: first manual connect, enable the setting, fully close and reopen the app; also with the tunnel already running
- [ ] Refresh token rotation & remote device revocation
- [ ] Account subscription sync vs. manual URL / QR / file import & duplicate check
- [ ] Expired subscription & traffic exhaustion handling
- [ ] Real tunnel establishment + public IP change + DNS leak verification per OS
- [ ] Persian (`fa-IR`) complete RTL visual inspection on every screen
- [ ] Light & Dark theme contrast audit (WCAG AA)

> **Rule**: A green web build or UI preview is never accepted as proof of a functioning VPN tunnel.

## 3. First real run after steps 42 - 45 (design pass)

Nothing from 0.4.28 - 0.4.30 was type-checked, built or rendered where it was written (no `node_modules`). Do this once, in order, and stop at the first failure:

1. `npm run check` — runs `tsc --noEmit`, `npm test` and `vite build`. If `tsc` fails, the likely places are `src/signupLink.ts`, `src/features/subscriptions/planSummary.ts`, `LoginScreen.tsx`, `SubscriptionsView.tsx`, `StatisticsView.tsx`, `ConnectionButton.tsx`. Send the first error.
2. `npm run build && npm run preview`, open the page in the browser, DevTools device mode at **360, 390 and 430 px wide**, then desktop. Compare each screen with `docs/design/reference.png`:
   - **Login:** logo glow, two fields with icons, "ورود", skyline at the bottom. With `VITE_SIGNUP_URL=https://example.com` set at build time the "ثبت‌نام در حساب کاربری" link appears (password mode only); without it, it is hidden.
   - **Home:** green "متصل هستید" pill, timer, dotted map, download/upload cards, server card, Power button. Idle = dark disc + neon ring; connected = green. Check the ring and glow are not too strong or too weak.
   - **Servers:** tabs, rows with flag / ping / star, fixed "اتصال به سرور" button not hidden by the bottom bar.
   - **Subscriptions:** plan line (`700 GB | 180 Days` only if the panel gives size and dates), usage ring, expiry date in Persian calendar, "افزودن اشتراک جدید" switches to the import tab.
   - **Statistics:** daily / weekly / monthly tabs, bar chart, download + upload pair, and the large "مصرف کل" card under them.
   - **Settings:** unified list, switches, support row.
3. Watch the browser Console on every screen for errors.
4. Android: push and read the first CI build log (first real compile of the Java from 0.4.20 - 0.4.27), then check on a device: foreground notification, the notification permission dialog (Android 13+), service type on Android 14+, server delays after connect.
