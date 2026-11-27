## Step 55 — Full visual redesign (flat, professional)
- New flat palette (graphite + one calm blue); green only for "connected", red only for errors. No neon, glow, glass or dot grids.
- Home: status + timer, one clean connect control, server row, session traffic card.
- Login: no skyline; brand, method tabs (username / subscription link), form, secondary actions.
- Settings: grouped sections (General, Connection, Security & network, Help) with one-line hints.
- Bottom tab bar: flat, active pill. Base components (Card, Button, Input, Toggle, Segmented, Banner) restyled.

## Lazy-loaded screens (0.4.12, step 17)
- **UI code change** (`src/client/AsisClientShell.tsx`, new `src/client/LazyScreen.tsx`): the Account, Settings, Statistics, Support and Gateway-status screens now load when first opened (`React.lazy`). Home, Servers and Subscriptions stay in the first download. While a screen loads, a small spinner shows (no text, nothing to translate); if the download fails (offline), the person sees an English + Persian message with a Reload button instead of a blank page; going to another screen clears it.
- **Effect on size** (from `npm run build`): the app chunk went 290 kB -> 181 kB; the charts library (recharts) no longer loads at start, it comes with the Statistics screen (`statistics-*.js`, 463 kB). First load is now index 181 kB + react 218 kB + CSS. `vite.config.ts`: the manual `charts` chunk group from 0.4.9 was removed (it pulled recharts back into the first download); the `react` group stays.
- Checked here: `tsc --noEmit`, `npm run build`, `npm test` (74), and a one-off jsdom run (NOT added to the repo, needs jsdom) of `LazyScreen`: spinner while loading, content after load, retry message on a failed load, failure cleared on screen change - all 3 passed. `tests/lazyScreensTests.ts` guards that the shell keeps those five screens lazy.
- NOT checked: the real app in a browser or the Android WebView (no browser here). Android loads the chunks from the app's own files, so a failed download is unlikely there.
- Owner test steps: `npm run build && npm run preview`; open the page, log in; in the browser Network tab confirm `statistics-*.js` is NOT loaded on Home; tap Statistics (it loads, the chart appears), then Settings, Account, Support; switch language and theme on each; watch the Console for errors. Then turn the network off (DevTools > Offline), open a screen you have not opened yet: you should see the Reload message. If a screen misbehaves, tell me which one and its Console error.

## Nonce in the signed login body (0.4.11, step 16)
- **Gateway change** (`src/gateway/adapters/resellerAdapter.ts`): the `/verify-login` body now also carries `nonce` (16 random bytes, hex). Reason: the reference receivers refuse a repeated signature (replay protection), and two identical logins in the same second used to have the same signature, so a double tap could show one failed login. Receivers may ignore `nonce`; it is documented in `RESELLER_INTEGRATION.md` section 0. A receiver written to the old contract keeps working (extra JSON field).
- Tests: the existing body assertion in `tests/resellerTests.ts` now checks the nonce format; new tests in `tests/resellerReceiverTests.ts` and `tests/resellerPythonReceiverTests.ts` log in twice in the same second (both must succeed). I confirmed both new tests FAIL when the nonce line is removed.
- Run here: `tsc --noEmit`, `npm run build`, `npm test`, `python3 test_receiver.py`.

## Python reference receiver for `/verify-login` (0.4.10, step 15)
- **Still not the sales bot** (its source was not in this conversation). `reference/verify-login-receiver/receiver.py` is the same receiver as `receiver.ts` in Python, standard library only: copy `create_verify_login_handler` into the bot, call it from the bot's own route with the RAW body bytes and the two `X-ASiS-*` headers, and plug the bot's customer table into `lookup` / `verify_password`. The scrypt helpers and the tiny HTTP server in the file are demo only.
- Tests: `reference/verify-login-receiver/test_receiver.py` (7 unittest tests, run with `python3 test_receiver.py` in that folder: good login, wrong password = unknown user, bad signature / old timestamp / missing headers, tampered body, replay, throttle + reset, malformed JSON) and `tests/resellerPythonReceiverTests.ts` (2 tests in `npm test`, skipped if `python3` is missing): the real `HttpResellerAdapter` against the running Python demo server.
- Found, not changed: the replay rule means two requests with the same username, same password and the same second have the same signature, so the second gets 401. A person double-tapping Login within one second can see one failed attempt. Cheap fix on the gateway side if wanted: add a random `nonce` to the signed body (the receivers would ignore it).
- Still open: setting/changing the app password inside the bot, `getCustomerProfile`, purchased services, password recovery (need the bot's real data model).
- Run here: `python3 test_receiver.py` 7/7, `tsc --noEmit`, `vite build`, `npm test`.

## Vendor chunk split (0.4.9, step 14)
- `vite.config.ts` only (no source change): `build.rolldownOptions.output.codeSplitting.groups` puts `recharts` and its dependencies in a `charts` chunk and React in a `react` chunk. Build output: app 290 kB, charts 453 kB, react 207 kB (was one ~950 kB file); the 500 kB chunk warning is gone. Total size is about the same; the gain is caching (vendor files do not change when the app changes) and parallel loading.
- Checked: build succeeds; `vite preview` serves index.html and all 5 asset files with HTTP 200; every JS file passes `node --check` as an ES module; `tsc --noEmit` and `npm test` (69/69) pass.
- NOT checked: that the page actually starts in a browser or in the Android WebView (no browser in this environment). Test steps: `npm run build && npm run preview`, open the page, log in, open Home and the usage chart, and look at the browser console for errors. If anything is wrong, delete the `build` block in `vite.config.ts` to go back to one file.
- Android note: the 3 extra files all end up in `dist/` and are bundled by Capacitor like the rest.

## Vite config warning + CI install checked (0.4.8, step 13)
- `vite.config.ts`: `__dirname` replaced by `import.meta.dirname` (Node >= 22 is already required in `package.json`). Vite 8 warned that `__dirname` will stop working with its native config loader. After the change the warning is gone and the `copy-unbundled-src-assets` plugin still copies `src/assets` into `dist/src/assets` (checked in the build output).
- CI check done by running its own commands here: plain `npm install` then `npm install --no-save @capacitor/core@7 @capacitor/cli@7 @capacitor/android@7 @capacitor/status-bar@7 @capacitor/splash-screen@7 @capacitor/assets@3` both succeed (the second prints deprecation warnings for `tar` and `glob`, not errors). The rest of `android-apk.yml` (cap add android, libbox build, Gradle) was NOT run.
- Found, not changed: the web bundle is one ~950 kB chunk (Vite warns above 500 kB); fixing it means code-splitting in the UI, left for the owner to decide. `bun.lock` is out of date (bun is not installed here).
- Run here: `tsc --noEmit`, `vite build`, `npm test`.

## Reference receiver for `/verify-login` (0.4.7, step 12)
- **Not the sales bot.** The bot's code is not in this repo, so this is a reference to copy from: `reference/verify-login-receiver/receiver.ts` (only `node:crypto`; the bot plugs its own customer lookup and password check into `lookup` / `verifyPassword` / `burnPasswordCheck`).
- It enforces the contract in `RESELLER_INTEGRATION.md` section 0: HMAC-SHA256 over `timestamp.rawBody` compared in constant time, timestamp within 60 s, one use per signature (replay -> 401), at most 5 failed passwords per username per 15 min (then 429 with no password check), and wrong password = unknown user (same 401, a dummy hash is burned for unknown names).
- `tests/resellerReceiverTests.ts` (5 tests, in `npm test`) runs the real `HttpResellerAdapter` against it over HTTP (no network): good login and suspended, wrong password / unknown user -> `AUTH_INVALID_CREDENTIALS`, wrong API key, tampered body / old timestamp / missing headers / replay -> 401, throttle -> `AUTH_RATE_LIMITED` and recovery after the window.
- Limits to know: the throttle and replay memory are in-process (lost on restart, not shared between bot workers; use the bot's DB/Redis if it runs several); the receiver does not set or change passwords (that is bot work, still open); HTTPS must be provided by the reverse proxy.
- Run here: `tsc --noEmit`, `vite build`, `npm test`.

## Locked-account path from gateway to client (0.4.6, step 11)
- No product code changed. `tests/authClientLockTests.ts` (2 tests, added to `npm test`) runs the real `HttpAuthClient` against the real gateway router (in-memory store, fake panel, no network): the 3rd wrong password comes back as `AUTH_ACCOUNT_LOCKED` with `recoveryAction: contact_support`, the right password afterwards is still `AUTH_ACCOUNT_LOCKED`, and the first wrong ones are `AUTH_INVALID_CREDENTIALS`. A second test checks that the locked title/body exist in every locale and differ from the generic wrong-password texts.
- `AuthForm.tsx` maps `AUTH_ACCOUNT_LOCKED` to those texts (read in the code, lines ~190 and ~209). The React rendering itself is NOT tested here (no DOM test setup in the repo) and was not looked at in a browser.
- Run here: `tsc --noEmit`, `vite build` and `npm test`.

## Install and build fixes (0.4.5, step 10)
- **Plain `npm install` failed (ERESOLVE)**: the root `esbuild ^0.25.0` conflicted with Vite 8's optional peer `esbuild ^0.27 || ^0.28`. Nothing in the repo imports esbuild directly, so it is now `^0.28.0`. `.github/workflows/android-apk.yml` runs a plain `npm install`, so the CI would have stopped at that step.
- **`vite build` failed**: `recharts` needs `react-is` (peer) and it was not a dependency, so Rolldown could not resolve it. Added `react-is ^19.0.1`.
- No source code changed. Versions here: vite 8.4.0, plugin-react 6.3.0.
- Run here: plain `npm install` OK, `tsc --noEmit` exit 0, `vite build` OK (one 950 kB chunk warning, not fixed), `npm test` 62/62.
- Not done: `bun.lock` still lists the old versions (regenerate it if you use bun); `package-lock.json` is not shipped; Android CI and device runs not run. The build warns that `vite.config.ts` uses `__dirname` (works today, planned to break in a future Vite major).

## Gateway flow tests: reseller fallback, refresh, logout (0.4.4, step 9)
- No product code changed. `tests/gatewayFlowTests.ts` (6 tests, added to `npm test`), real HTTP with an in-memory store, a fake panel and a fake reseller (no network):
  - a name that is not a gateway account goes to the reseller and ends in the same PasarGuard link pipeline (`/user/me` answers with the panel username); wrong reseller password -> 401; suspended -> 403 `AUTH_ACCOUNT_SUSPENDED`;
  - a gateway account never calls the reseller;
  - refresh rotates the token, the old refresh token is refused (`AUTH_SESSION_EXPIRED`), a wrong or missing `deviceId` is refused (401 / 400), logout revokes the device (`AUTH_DEVICE_REVOKED` on the next call), missing or garbage bearer -> 401.
- Run here: `tsc --noEmit` and `npm test`. Not run: `vite build`, Android CI, device.

## Gateway HTTP tests: admin routes + login wiring (0.4.3, step 8)
- No product code changed. Closes the gap named in 0.4.2: `router.ts` login wiring and `adminRoutes.ts` are now exercised over real HTTP (express on an ephemeral port, in-memory store, fake PasarGuard adapter, `NotConnectedResellerAdapter`; no network).
- `tests/gatewayHttpTests.ts` (5 tests, added to `npm test`): admin key missing/wrong -> 401; username/password/link validation -> 400 (a link of another panel is refused); create (201) -> update (200) -> login -> 3 wrong passwords -> 423 `AUTH_ACCOUNT_LOCKED` -> right password still 423 -> admin unlock with new password -> old password 401, new password 200 -> delete (204) -> 404; admin responses never contain the password or the link token; unknown username gives the same status and code as a wrong password; password recovery answers the same for a known and an unknown name.
- Install note: `npm install` fails with ERESOLVE (`@vitejs/plugin-react` peer conflict); `npm install --legacy-peer-deps` works. Not changed here (owner decision).
- Run here: `tsc --noEmit` exit 0; `npm test` all pass (see counts in the handoff). Not run: `vite build`, Android CI, anything on a device.

## Gateway-held accounts, 3-strike lock, admin unlock (0.4.2, step 7)
- **Accounts live in the gateway** (`local_accounts` in SQLite, or in memory): username, scrypt password hash (random salt, per-password), the customer's PasarGuard subscription link (AES-GCM at rest in SQLite). `/auth/login` checks these first; a correct password continues into the same link-login pipeline (servers, usage, configs from PasarGuard). Reseller is only the fallback when it is configured.
- **3 wrong passwords lock the account** (`MAX_FAILED_LOGINS`): each attempt is counted atomically BEFORE the password is checked, so parallel guesses cannot get more than 3 checks. The 3rd wrong one answers `423 AUTH_ACCOUNT_LOCKED`; a locked account refuses even the right password. A correct password resets the counter. No automatic expiry: only an admin unlocks.
- **Unknown usernames** get the same `AUTH_INVALID_CREDENTIALS` (and the same hashing cost) as a wrong password, so names cannot be probed by timing or message. `/auth/password-recovery` answers "contact support" for gateway accounts without revealing whether the name exists.
- **Admin API** (`src/gateway/adminRoutes.ts`, `/api/v1/admin/*`, off unless `ADMIN_API_KEY` >= 32 chars; header `X-Admin-Key`, constant-time compare, 30 req/min): `PUT /accounts/:username` (create or reset password + link, clears the lock; the link must belong to a configured panel), `GET /accounts/:username` (locked, failedAttempts, lockedAt, lastLoginAt), `POST /accounts/:username/unlock` (optional `newPassword`), `DELETE /accounts/:username`. Actions are logged without passwords. Keep this path off the public internet (reverse-proxy allowlist or VPN).
- App: Persian/English "Account locked" message for `AUTH_ACCOUNT_LOCKED`.
- Trade-off to know: the lock is per account, so someone who knows a username can lock it by guessing wrongly 3 times (the admin unlocks it). The existing per-IP `authRateLimit` slows this down but does not remove it.
- Tests: `tests/accountTests.ts` (10 tests, memory and SQLite: hashing, lock, unlock, new password, 12 parallel guesses -> 3 checks). Not covered here: the router wiring and admin routes (gateway tests need express, not installed in this environment); `tsc` was not run in full.

## Password login via the reseller (0.4.1, step 6)
- `HttpResellerAdapter.authenticateEndUser` now calls `POST {RESELLER_BASE_URL}/verify-login` (HMAC-SHA256 signed with `RESELLER_API_KEY`, 8 s timeout, no redirects, capped body). Contract in `RESELLER_INTEGRATION.md` section 0.
- `/auth/login` hands the returned `subscription_url` to the same pipeline as link login, so password users get servers, usage and configs from PasarGuard with no extra work. A link that does not belong to a configured panel gives `ACCOUNT_SUBSCRIPTION_MISMATCH`; suspended accounts get 403.
- Still pending: the bot-side endpoint and password setup (step 7), `getCustomerProfile`, purchased services and password recovery.
- Tests: `tests/resellerTests.ts` (signature, mapping, 401/429/5xx/garbage/unreachable). The router change itself is not covered here (the gateway tests need express, not installed in this environment) and `tsc` was not run.

## Auto-connect on app open (0.4.0, step 5)
- **Setting** `policy.autoConnect` (Settings, off by default): when the app starts it reselects the last used server (`asis_last_server_v1`) once the catalog has it, then connects through the normal Connect path (so auto-switch applies too).
- **Rules** (`src/features/home/autoConnect.ts`, pure and tested): once per launch only (disarmed after 20 s if the server list never appears); never before the first successful manual connection on this device (`asis_vpn_consent_v1`, set at the first real `Connected`), so the OS VPN-permission dialog never pops up unprompted; skipped if the user picks a server or presses Connect first; skipped if the full server link is not in memory (links are memory-only and return with account sync; manually imported servers lose theirs on restart); skipped if the native service already reports Connected/Connecting.
- Errors from an automatic attempt show in Home exactly like a manual one. No retry loop.
- Not verified on a device. On mount Home now reads the real native state, so a tunnel that outlived the web view shows as Connected (and auto-connect never starts a second one).
- Tests: 2 new cases in `tests/engineTests.ts` (12/12 pass). Full `tsc` and the gateway tests were not run here (no node_modules, no network).

## Tunnel latency + auto-switch via urltest (0.3.9, step 4)
- **Auto-switch** (Settings, off by default, `policy.autoSwitch`): connecting builds one sing-box config with up to 12 servers of the selected server's subscription (selected first, then best phone ping) as `node-0..N` plus a `urltest` outbound `proxy` (test URL `https://www.gstatic.com/generate_204`, every 2 min, tolerance 60 ms). The core switches seamlessly; the app does not reconnect. One server, or a failed group, still connects as a single `proxy` outbound. `buildSingBoxConfig` takes one outbound or an array; `connectGroup` on the engine adapter; the bridge `connect` accepts an object or an array.
- **Real tunnel latency**: the test goes through the tunnel (so for an Iran-entry tunnel it is entry + relay + exit), not to the entry host. Home shows "Tunnel latency" and, in auto mode, the active server; Exit Region, the flag and the leak check follow the server the core is actually using and the exit IP is re-read when it changes.
- **How it is read**: sing-box `experimental.clash_api` on `127.0.0.1:<random port>` with a random secret generated per connection. Java (`AsisVpnPlugin.getTunnelStatus` / `runTunnelTest`) talks to it over a raw HTTP/1.0 socket (a plain `http://` call would hit Android's cleartext policy). Controller address/secret live in memory only (`VpnRuntime`) and are cleared on disconnect.
- **Safety net**: if the libbox build refuses `clash_api`, `LibboxTunnelEngine` retries once without it; the tunnel comes up, only the latency readings are missing (`available: false`, shown as nothing, never invented). `build-libbox.sh` prints whether the tag is present.
- Not compiled here: Java changes need CI (no javac/Android SDK here). Not verified on a device: urltest timings, the controller endpoints (`/proxies/proxy`, `/group/proxy/delay`) were written against sing-box 1.11 behaviour.
- Tests: config (group, caps, validation) and bridge (array connect, controller, status passthrough) in `tests/engineTests.ts` (10/10 pass).

## Phone-side TCP ping (0.3.8, step 3)
- New native method `AsisVpn.tcpProbe` (Java, `AsisVpnPlugin.java`) + `window.AsisNativeBridge.tcpProbe`: TCP handshake time from the phone to each server (2 attempts, best time kept, 8 in parallel, max 100 targets, timeout 0.5-10 s). Sockets are bound to the physical non-VPN network, so the number is the phone -> server path even while the tunnel is connected (otherwise it would measure through the tunnel).
- "Test Ping" in the Android app now uses it first (`probeFromPhone`); a browser, or a native failure, falls back to the gateway probe as before. Results carry `source` (`phone_tcp_probe` | `gateway_tcp_probe`) and `measurementSource` follows it.
- For tunnel servers the number is the entry hop only; the notice text says so. End-to-end tunnel latency and auto-switch via urltest are step 4.
- Not compiled here: the Java method has no javac/Android SDK in this environment; CI (`android-apk.yml`) is the first real build.
- Tests: `probeFromPhone` normalisation + probe `source` in the catalog (`tests/runTests.ts`).

## Real exit IP + leak warning (0.3.7, step 2)
- Home no longer reads the IP once on mount. `src/features/home/exitCheck.ts` asks ipwho.is, then api.country.is, then ipify (IP only) which address/country the internet sees; it re-checks 1.2 s after `Connected` (up to 3 tries) and after `Disconnected`, and clears the value while connecting/disconnecting so a stale Iranian IP is never shown as the exit IP.
- `evaluateExit()` compares the measured country with the selected server (the EXIT country for tunnels): `ok` shows "Verified from the live exit IP"; an Iranian IP on a foreign server is an error banner (tunnel not carrying traffic); another foreign country is a warning to fix the `[TUN entry>exit]` tag.
- Note: the check goes through the tunnel only if this app is not excluded by split tunneling.
- Tests: `evaluateExit` in `tests/runTests.ts`.

## Tunnel routes: entry vs exit (0.3.6, step 1)
- Servers can now be marked as **tunnel** routes (e.g. Iran entry relaying to a foreign exit). Mark them in the server name / panel remark: `[TUN IR>DE]`, `[TUNNEL IR->NL]`, `[تانل IR→FR]`, or `[TUN DE]` (entry assumed IR). Never guessed: no tag = direct.
- `ServerCatalogEntry` gets `route` (`direct` | `tunnel`) and `entryCountryCode`; for tunnels `countryCode`/flag describe the **exit** country, so Home's "Exit Region" no longer shows the entry country. The tag is stripped from the displayed name.
- Home shows a Tunnel badge and "via IR entry"; the server list shows an `IR → DE` badge.
- `parseTunnelTag()` in `serverCatalogUtils.ts` + test in `tests/runTests.ts`.
- Next: real exit IP/country after connect (step 2), phone-side TCP ping + tunnel RTT via urltest (step 3), auto-connect on open (step 4).

## Android native bridge + real server links (0.3.5)
- **Connect now uses the real server link.** Before, the Connect button built its outbound from the redacted host, so no tunnel could ever have worked. `src/engine/endpointLinks.ts` keeps the full links (with UUID/password) in memory only, filled by account sync and manual import (`extractEndpointLinks`), and cleared on sign-out. Missing link -> `ENGINE_NO_CONFIG`.
- **Link -> sing-box conversion completed** (`protocolValidator.ts`): VLESS/Trojan/VMess now carry TLS options, Reality key + short id, flow, uTLS fingerprint and ws/grpc/http/httpupgrade transport; Shadowsocks (SIP002), Hysteria2 (incl. salamander), TUIC, SOCKS/HTTP carry their credentials. WireGuard links and links without credentials are rejected instead of producing a half config.
- `src/engine/singBoxConfig.ts`: builds the full sing-box 1.11 config (TUN, DNS through the proxy, DNS hijack, private-network bypass, IPv6 off = rejected, per-app include/exclude packages). "Bypass domestic" is refused with `ENGINE_POLICY_UNSUPPORTED` (no bundled geo rule set yet).
- `src/engine/nativeBridge.ts` installs `window.AsisNativeBridge` inside the Android app from the Capacitor plugin `AsisVpn`.
- `native/android/`: Java sources (Capacitor plugin, `VpnService`, state holder) and two engine variants: `engine-libbox` (sing-box through `libbox.aar`) and `engine-stub` (reports `ENGINE_LIBBOX_MISSING`; never fakes Connected). The old Kotlin skeleton that set Connected right after `establish()` is removed.
- CI: builds `libbox.aar` from SagerNet/sing-box (`SING_BOX_REF`, default `v1.11.15`), installs the plugin, patches the manifest, and falls back to the stub engine if the core cannot be built or compiled.
- Native error codes (`ENGINE_VPN_PERMISSION_DENIED`, `ENGINE_CONNECT_TIMEOUT`, ...) now reach the UI instead of a generic code.
- Tests: `tests/engineTests.ts` (8 tests), run by `npm test` together with the gateway tests.

## Link sign-in screen + automatic server sync (0.3.4)
- Sign-in screen has two tabs: **Subscription link** (default) and Username & password. The link tab calls `POST /auth/login-link` (`AuthClient.loginWithLink`); link errors get their own message instead of "invalid username or password". Persian and English texts added.
- `src/features/subscriptions/accountSync.ts`: loads the account subscriptions and, for each one, its config, so the Servers screen gets real endpoints. The Subscriptions "sync" button and the shell share it.
- `AsisClientShell`: account subscriptions load automatically right after sign-in and are removed on sign-out.
- Gateway `GET /servers` now returns a server list (name, protocol) for link-login users; country and live latency stay empty until probed.

## Login with a PasarGuard subscription link (0.3.3)
- `POST /api/v1/auth/login-link`: the user pastes the subscription link; the gateway checks it belongs to a configured instance (host + prefix allowlist, no redirects, 8 s timeout, 2 MB cap), asks the panel's public `/sub/{token}/info`, and issues the normal token pair. No admin token needed.
- `src/gateway/linkedAccount.ts`: linked-account login + mapping to subscription/usage. The secret token is stored server-side only (encrypted in SQLite) in the new `linked_accounts` table.
- Linked users get real data from `/user/me`, `/subscriptions`, `/subscriptions/:id`, `/subscriptions/:id/config`, `/subscriptions/:id/refresh` and `/usage` (no per-day history: the public endpoint has none).
- `PASARGUARD_BASE_URL` alone now enables the instance; new `PASARGUARD_SUBSCRIPTION_BASE_URL`. `allowedDevices` is nullable. `/servers` is not wired yet.

## Persistent gateway store (0.3.2)
- `SqliteGatewayStore` (`src/gateway/adapters/sqliteGatewayStore.ts`): devices, refresh sessions (rotation + reuse detection, same rules as before) and imported subscriptions persist in SQLite via the built-in `node:sqlite` (no new dependency). Imported subscription URLs are AES-256-GCM encrypted at rest.
- `GatewayStore` interface; the router now takes it instead of the concrete in-memory class. `ASIS_DB_PATH` set = SQLite, unset = in-memory (warning in production). New env vars `ASIS_DB_PATH`, `ASIS_DB_KEY`; `data/` is git-ignored.

## Gateway CORS for the packaged app (0.3.1)
- `src/gateway/cors.ts`: CORS for `/api` so the Capacitor app (origin `https://localhost`) can reach the gateway on another domain; preflight answered with 204, unknown origins get no CORS headers (403 on preflight).
- `ASIS_ALLOWED_ORIGINS` env var for extra origins (documented in `.env.example`).

## Native app feel + Android packaging (Capacitor)
- App icon and splash generated from the AS shield logo (`assets/`, built into the APK by `@capacitor/assets` in CI).
- Static boot splash in `index.html` that fades out after first paint, so native splash to app has no white flash.
- Android back button / browser back now walk screen history (`AsisClientShell`); back from the first screen exits.
- Light haptic ticks on tab changes and the Power button (`src/client/haptics.ts`, VIBRATE permission added in CI).
- Touch polish: press-scale feedback, no tap highlight, no overscroll bounce, hidden scrollbars, safe-area top padding; copyable values (`.font-mono`, inputs) stay selectable.
- `src/apiBase.ts`: prefixes `/api/...` with `VITE_API_BASE_URL` so the packaged app reaches the gateway.
- `capacitor.config.json` + `.github/workflows/android-apk.yml` build a debug APK on GitHub Actions; the workflow also unpacks an uploaded project `.zip`.

## UI restyle (neon dark, phone-first)
- Dark neon tokens, glass cards, gradient buttons, glowing logo; default locale is now Persian.
- Phone bottom tab bar (Home, Servers, Stats, Account, Settings).
- Login hero, Home status pill + dotted globe, server cards with sticky Connect, QuotaRing in subscriptions, gradient bar chart, quick-settings list.

## Security hardening pass
- `/servers/probe` now requires a Bearer token (was an open TCP port-scan endpoint); client sends the token.
- `ASIS_JWT_SECRET` (>= 32 chars) is mandatory in production; JWT header `alg` is verified as HS256.
- SSRF IP filter rewritten with `net.BlockList`: adds IPv4-mapped IPv6, NAT64, 6to4, multicast, reserved, benchmarking and TEST-NET ranges.
- Subscription import URLs with embedded credentials are rejected.
- Rate limiter now evicts idle keys (memory leak fix).
- JSON parse / oversize errors return 400 / 413 instead of 500; unknown API routes return a JSON 404; 500s are logged with their diagnosticId.
- Security headers added, `/api` responses are `no-store`.
- `package.json`: renamed to `asis-vpn`, removed unused `@google/genai`, `tsx` moved to dependencies, `start` runs in production mode.

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

## 0.4.30 (steps 43 - 45)
- **Statistics:** download and upload are now a pair of cards, and "مصرف کل" is its own large card under them (design). **Home:** the idle / connecting Power button is a dark navy disc with a neon-blue ring and a glowing blue icon (design); connected (green) and error looks are unchanged. Both use the existing theme variables.
- **Repo:** the design image is kept at `docs/design/reference.png`; `TODO-UI.md` got a "current status" section and its ticks match the code.
- **Tests:** 2 more source-guard tests in `tests/designGapTests.ts` (8 in the file, all pass with `node --test`).
- **NOT run:** `tsc`, `npm run build`, any render (no `node_modules` here). Colors of the Power button are estimated from the image by eye.

## 0.4.35 (step 54, from owner screenshots)
- **Sign-in:** the three links at the bottom sat on top of the Milad Tower. The skyline is now 22% of the screen height (was 34%), the content has more room above it (`pb-[26vh]`), the logo is a little smaller (h-36) and the links have a soft shadow for legibility. "ادامه بدون حساب (افزودن دستی اشتراک)" is shortened to "ادامه بدون حساب".
- **Settings:** the first switch was labelled "اتصال خودکار" but is "Auto reconnect"; it now says "اتصال مجدد خودکار", so it no longer looks like a duplicate of "اتصال خودکار هنگام باز شدن اپ".
- **Account (signed out):** one clean logo instead of a logo inside a ring; the long "token protection" card is a collapsed section.
- **Seen in the screenshots, not changed:** the Home Power disc was solid blue and the Split Tunneling card was still on the main Settings page, so that build did not have steps 51 - 52; check which zip it was built from. The floating Chrome icon on every screenshot is a screen overlay, not the app.
- **Checks:** 13 tests pass; `tsc` (missing React types): no new errors. Not built or rendered; the skyline/link spacing is calculated from the screenshot, not seen.

## 0.4.34 (step 53)
- **Statistics:** the "server usage vs local counters" cards moved from the top of the screen to a collapsed "جزئیات فنی مصرف" section under the chart (`<details>`, closed by default), so the screen opens on tabs, chart, download/upload and total, like the design. Nothing was removed; the data and sync button are still there.
- **Subscriptions:** the account/manual tab switch shows only when there is at least one account subscription (or the account tab is open). The "افزودن اشتراک جدید" link still opens the manual-import tab.
- **Checks:** 12 tests pass (`designGapTests`, `lazyScreensTests`); `tsc` with missing React types: no new errors, no syntax errors. Not built, not rendered.

## 0.4.33 (step 52)
- **Bottom tab bar:** hover and keyboard focus styles, a press response, a soft pill behind the active tab, and the active bar grows in (220 ms, off with reduced motion). **Server rows (phone):** hover lift, glow border and press response; the selected row keeps its neon border.
- **Looked at, left as is:** the smart-selection policy card is already hidden on phones (`hidden md:block`); it only shows on desktop.
- **Checks:** 11 tests in `designGapTests` + `lazyScreensTests` pass; `tsc` (missing React types) shows no new errors. Not built, not rendered; the look of the hover and the pill is unchecked.

## 0.4.32 (step 51)
- **Settings:** "Advanced" is now a separate sub-page (row with a short description and a chevron on the main list; the page has a back button and the view-enter animation, and scrolls to the top). Split tunneling / app selection and the advanced tunnel settings moved into it; the main list keeps language, auto-connect, kill switch, support and the version/update card. Before, one card toggled open in place.
- **Touch feedback:** on devices without hover, every enabled `button` shrinks slightly while pressed (`index.css`, off when the user asks for reduced motion). The new rows also have hover and focus styles.
- **Statistics:** no change needed; the source and chart-style switches were already hidden, only daily / weekly / monthly show.
- **Not done (needs a look at the real screens):** Servers smart-selection policy, Subscriptions tabs / import methods (owner did not pick them), extra cards on Statistics below the chart, hover/press polish for list rows and the bottom tab bar.
- **Checks:** `designGapTests` + `lazyScreensTests` 10/10; `tsc` with missing React types shows no new errors (one fewer). Not built, not rendered.

## 0.4.31 (step 47)
- **Decision, no code change:** the "تم برنامه" row from the design image is NOT built. The UI stays dark-only (locked in 0.4.13); a theme row with one choice, or a "light" option that does nothing, would be misleading. Revisit only if a light theme is brought back. The notifications and smart-DNS rows stay unbuilt for the same reason (no function behind them).
- **Cleanup:** removed the unused `ThemePaletteSwitcher` import and the unused `themePreference` / `setThemePreference` from `SettingsView.tsx` (checked by grep: no other use in the file). `tsc` not run here.
- **Test fix:** `tests/lazyScreensTests.ts` failed on the 0.4.28 code ("GatewayStatusView must be lazy") although the screen is lazy: its `import()` sits on the next line and the regex wanted one line. The regex now allows whitespace/newline after `=>`. Found by running `node --test` on the unzipped project; the same failure shows on the original zip, so it is not from this step.

## 0.4.28 (step 42)
- **Compared the app with the design image** (`1000133315.png`) by reading the code, not by rendering it. Changes:
  - **Home:** the connected pill now says "متصل هستید" (was "متصل و ایمن").
  - **Sign-in:** a "ثبت‌نام در حساب کاربری" / "Create an account" link, shown only in password mode and only when `VITE_SIGNUP_URL` is set at build time (new `src/signupLink.ts`: https only, no embedded credentials, opens with `noopener`). Accounts are not created inside the app (operator or sales bot), so with no URL set the link stays hidden instead of pointing nowhere. Documented in `.env.example`.
  - **Subscriptions:** a plan line such as `700 GB | 180 Days` under the name (new `planSummary.ts`): size from `totalBytes` (1 GiB units), days from `startsAt`/`expiresAt`; a part with no data is left out, nothing is made up. Plus an "افزودن اشتراک جدید" link at the bottom of the account tab that switches to the manual-import tab.
- **Deliberately NOT done (design shows them, the app has no function behind them):** the "اعلان‌ها" (notifications) row, "DNS هوشمند" (the app only has a custom DNS field) and the "تم برنامه" row (the theme was locked to dark in 0.4.13; the design shows "روشن", which contradicts a dark-only UI, owner to decide). A switch that does nothing would be a lie. "تمدید اشتراک" still appears only when the panel gives an https renewal link.
- **Tests:** `tests/designGapTests.ts` (6 tests, in `npm test`): URL validation (http, `javascript:`, credentials, garbage rejected), plan line cases (700 GB / 180 days, missing data, unlimited, bad dates), plus source guards for the Home wording, the sign-in link and the subscriptions wiring. With the Home wording reverted one test fails.
- **Type check:** no `node_modules` here, so I ran `tsc` with no React types and only looked at errors that are not about missing types. It found one real error in my first version (`SIGNUP_URL` is still `string | null` inside `onClick`); fixed. The rest of the new code shows no such errors. NOT run: the real `tsc`, `npm run build`, and nothing was rendered, so spacing and look of the new lines are unchecked.
- Design note: in the image the Upload card has a download arrow; that is a drawing mistake and was not copied.

## 0.4.27 (step 41)
- **Brand notification icon.** The foreground notification used a system lock icon. Now `native/android/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_stat_asis.png` (24/36/48/72/96 px, white on transparent, the "AS" letters cut out of `public/assets/asis-logo.png` by brightness, looked at by eye) are copied into the Android project by `install-native.sh`, and `AsisVpnService` uses them through `getIdentifier` (no dependency on the generated `R` class), falling back to the old system icon if the file is missing. The install step was run on a fake project: all 5 files land in `res/`.
- **Caught by the syntax check, not by the tests:** my first version had `drawable-*/` inside a Java doc comment, and `*/` ended the comment early (`';' expected`). Fixed. Lesson kept in this file: the step 37 - 41 source-guard tests only read text, so always run `syntax-check.sh` after a Java edit.
- **Tests:** one more in `tests/foregroundServiceTests.ts` (now 6): icon lookup, `setSmallIcon(statusIcon())`, all 5 PNGs exist and are PNGs, the install script copies `res/`.
- **NOT verified:** how the icon looks on a real status bar (it is a hand-cut silhouette; thin strokes may look rough at 24 px). A designer-made monochrome icon is better when available; drop the 5 files over these.
- `IMPLEMENTATION_STATUS.md` brought up to date (it was still at 0.4.12).

## 0.4.26 (step 40)
- **`readTunnelStatus` is now one request instead of one per server** (`AsisVpnPlugin.java`). It asks the local controller `GET /proxies` once (every outbound with its delay history) and builds the same result (`available`, `active`, `delays`) from it. Before: one request per server in a row, 3 s read timeout each, so a slow controller with N servers could take N x 3 s. The tag whitelist and the single-outbound case are unchanged. The controller reply size cap went from 256 KB to 1 MB (loopback, our own sing-box) so a big server list fits.
- **Fallback kept:** if `/proxies` gives no answer or no `proxy` group, the old one-by-one path runs, now with a total limit of `STATUS_FALLBACK_MS` (6 s); servers not asked in time come back as `null` (unknown, not a failure). No JS change needed.
- **Tests:** `tests/tunnelStatusTests.ts` (3 source-guard tests, in `npm test`). `syntax-check.sh` OK (9 files). The Java itself was NOT run (no Android jars here), so the parsing is checked by reading only.
- **NOT verified:** that sing-box's `clash_api` answers `GET /proxies` with `{"proxies": {tag: {history: [...]}}}` as I expect (from memory of the Clash API; no core available offline). On a device with the tunnel up, open the server list and check delays still show; if they all turn to "unknown", the fallback is what you are seeing, tell me and I will look at the real reply.
- Open items from step 35 are now all handled. Remaining: device/CI verification, secure-storage plugin install, bot-side work (see earlier list).

## 0.4.25 (step 39)
- **Notification permission (Android 13+)** (`AsisVpnPlugin.java`, `patch_android.py`). The foreground notification from 0.4.24 is hidden on Android 13+ until `POST_NOTIFICATIONS` is granted. The plugin now asks for it **once per install**, only **after the tunnel is up** (so it never stacks on the VPN consent dialog), and the answer is not waited for: a refusal, a missing activity or any exception does not touch the connect result. Below Android 13, or when already granted, nothing is asked. The manifest patch declares the permission (still idempotent; checked twice on a sample manifest, valid XML).
- **Tests:** one more source-guard test in `tests/foregroundServiceTests.ts` (now 5): asked only after `call.resolve()`, API/granted/already-asked checks, flag saved, no `call.reject` inside. With the "already asked" line removed it fails. `syntax-check.sh` OK (9 files).
- **NOT verified:** on a device. Please check on Android 13+: after the FIRST successful connect the system permission dialog appears once; after allowing, the notification shows; after denying, nothing is asked again on later connects (to see it again: clear app data).
- Trade-off: the dialog shows while the app is already connected, not before. That keeps connect fast and avoids two dialogs at once.

## 0.4.24 (step 38)
- **Foreground notification for the VPN service** (`AsisVpnService.java`, `patch_android.py`). On connect the service now calls `startForeground` with an ongoing, low-importance notification ("Connecting..." then "Connected", Persian when the phone language is `fa`) with a **Disconnect** button (sends `ACTION_STOP`) and a tap target that opens the app. It is removed on disconnect, on every failed-start path, on revoke and in `onDestroy`. Goal: Android is less likely to kill the tunnel when the app is in the background.
- **Never fatal:** if the system refuses `startForeground` (missing permission, background-start limits) the error is logged and the tunnel runs exactly as before.
- **Manifest** (`patch_android.py`, still idempotent): adds `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SYSTEM_EXEMPTED` permissions and `android:foregroundServiceType="systemExempted"` on the service. I ran the script twice on a sample manifest: second run changes nothing, result is valid XML.
- **Tests:** `tests/foregroundServiceTests.ts` (4 source-guard tests, in `npm test`); with `leaveForeground()` removed from `onDestroy` one of them fails. `syntax-check.sh` OK (9 files).
- **NOT verified, please check on a device / CI:**
  - `systemExempted` is the type I believe applies to VPN apps on Android 14+; I could not check the Android docs offline. If the CI build or Android 14 device rejects it, try `specialUse` (needs a property tag) and tell me the error.
  - Android 13+ asks for the `POST_NOTIFICATIONS` permission; without it the service still runs but the notification may be hidden. The app does not ask for it yet.
  - The small icon is a system lock icon (`ic_lock_lock`), a placeholder until a proper white-on-transparent icon is added.
- Still open: `readTunnelStatus` asks the controller one server at a time.

## 0.4.23 (step 37)
- **`tcpProbe` now has an overall time limit** (`native/android/src/com/asisvpn/client/vpn/AsisVpnPlugin.java`). Before, the plugin waited for every target with no total limit, so a slow DNS lookup or many servers could keep "ping all" running for minutes. Now the whole call stops at `PROBE_OVERALL_MS` (20 s): targets that did not finish are cancelled and returned as `available: false, latencyMs: null, error: "timeout"`; finished targets keep their results. Result order and count are unchanged, so the JS side needs no change.
- **Test:** `tests/probeLimitTests.ts` (source guard, in `npm test`): checks the deadline constant, the timed `get`, and the `timeout` result. It reads the Java file; it does not run it.
- Run here: `native/android/scripts/syntax-check.sh` (9 files OK). NOT run: the probe on a device, `tsc`, full `npm test`, build.
- Still open: no foreground notification for the VPN service; `readTunnelStatus` asks the controller once per server in sequence.

## 0.4.22 (step 36)
- **Connect guard in the engine adapter** (`src/engine/webEngineAdapter.ts`, `connectAny`): overlapping connects can no longer run together. The SAME request while one is running shares it (one native connect, both callers get the same result); a DIFFERENT request waits for the running one to finish and then runs (native treats it as a switch); a failed attempt does not block the next. Before, only the main button was disabled while busy, so auto-connect, auto-switch or a quick second tap could start two native connects at once. This is the JS side of the Java fix in 0.4.21. The old body of `connectAny` is now `connectNow`, unchanged.
- **Tests:** new `tests/connectGuardTests.ts` (4 tests, in `npm test`) with a fake native bridge whose `connect` is held open by the test: same request twice = 1 native call; different requests = never 2 running at once and in order; failure then next works; finished request connects again. I ran it here with `node --test`: 4/4 pass, and with the guard removed it fails; `engineTests` still 12/12.
- Run here: those two files plus `accountTests`, `lazyScreensTests`, `sessionSecureStoreTests`, `shellSessionRestoreTests` (all pass). NOT run: `tsc`, full `npm test`, build, a device.
- Still open from 0.4.21: `tcpProbe` has no overall time limit, and no foreground notification for the VPN service.

## 0.4.21 (step 35)
- **Read-through of the Android Java** (`AsisVpnPlugin`, `AsisVpnService`, `VpnRuntime`, `patch_android.py`) by reading only (no Android SDK here). Two real problems fixed in `AsisVpnService.java`:
  - **Quick double connect killed the tunnel.** Two `ACTION_START` intents in a row: the first one takes the pending config, the second gets `null`, and `start()` used to call `stopEngine()` before looking at the config, so the second one tore down the working tunnel and set `ENGINE_INVALID_INPUT`. Now a start without a config is ignored while an engine runs or is connecting; the config check also comes before `stopEngine()`.
  - **A failing `stop()` hid the real error.** After a failed start, `next.stop()` could throw a `RuntimeException` out of the worker task, leaving the state at "Connecting" until the 15 s timeout. Now `safeStop()` logs it and the real error code is reported.
- Checked: `native/android/scripts/syntax-check.sh` passes (9 files). NOT run: the service itself (needs Android); the fix is reasoned from the code, not tested on a device.
- **Found, not changed (decide later):**
  - `tcpProbe`: waits on each result with no overall time limit and DNS has no timeout; with many servers the "ping all" call can take minutes in the worst case (8 threads, 2 attempts x timeout per server).
  - `readTunnelStatus`: asks the local controller once per server, one after another (3 s read timeout each); fine locally, slow if the controller hangs.
  - `AsisVpnService` is started with `startService` and never calls `startForeground`; this is allowed for a VPN started from the foreground app, but if Android kills the app in the background the tunnel can end with it. A foreground notification would make it more durable.
  - The JS adapter (`webEngineAdapter.connectAny`) has no guard against a second `connect` while one is running; only the main button is disabled while busy. Auto-connect or auto-switch could still overlap, which is why the service fix above matters.

## 0.4.20 (step 34)
- **First real check of the Android Java code.** Until now the 9 Java files (`native/android/src`, `engine-libbox`) were never compiled anywhere. This environment has a JDK compiler but no Android SDK, so I ran the compiler without the Android / Capacitor / libbox jars: **no syntax errors, no bad types, no duplicate names** in the 9 files; the only errors are the expected "cannot find symbol / package does not exist" ones for the missing libraries. (The first run also reported `EngineFactory` as a duplicate: that is only because `engine-stub` and `engine-libbox` are alternatives and I had fed both; the script now checks libbox only.)
- New `native/android/scripts/syntax-check.sh` (+ `JavaSyntaxCheck.java`): repeats this check with `bash native/android/scripts/syntax-check.sh` (needs a JDK). I tested it by deleting a `;` in a copy of `VpnRuntime.java`: it reported `';' expected` and failed, then passed again after restoring the file.
- Other things run here that need no packages: `python3 test_receiver.py` 7/7 OK; `bash -n` on the three scripts in `native/android/scripts`; `py_compile` on `patch_android.py`; `android-apk.yml` parses as valid YAML.
- **What this does NOT prove:** that the Java uses the Android, Capacitor and libbox APIs correctly (method names, signatures, permissions), or that Gradle builds. Only the first CI build or a device build shows that. No app code changed.

## 0.4.19 (step 33)
- **Secure session storage, part 2 of 2: wired into the app shell** (`src/client/AsisClientShell.tsx`). If the secure-storage plugin is present, the shell starts in a short "restoring" state (blank screen, no sign-in flash), loads the saved session with `loadSessionSecure()`, and only then (a) allows the save effect to run and (b) does the launch token refresh. Saving always goes through `persistSessionSecure()`. Without the plugin nothing changes: the synchronous load and the same save/refresh behaviour as before (`sessionRestoring` is false from the start).
- Why the order matters: the empty initial state must never be saved while restoring, or it would erase the stored session. `tests/shellSessionRestoreTests.ts` (3 source-guard tests, in `npm test`) checks this order, the screen order (restoring before sign-in) and that the old direct `persistSession` call is gone. I ran it here: 3/3 pass, and with the "do not save while restoring" line removed it fails.
- **Not active until the plugin is installed.** To turn it on, where `npm install` works: install `capacitor-secure-storage-plugin` at a version that supports Capacitor 7 (check its README; I could not check offline), add it to the install list in `.github/workflows/android-apk.yml` and run `npx cap sync android`. Until then the app still uses `localStorage`, as the 0.4.17 texts say. After it is active, update the login-screen text and `SECURITY.md` again.
- Run here: the two session tests (10/10), and a type-parse check of the edited files (no syntax or unknown-name errors; full `tsc` could not run without `node_modules`). NOT run: full `npm test`, build, the app on a device (the restore flow itself is only checked by reading and by the source guard, not rendered).

## 0.4.18 (step 32)
- **Secure session storage, part 1 of 2 (storage layer only, not used by the UI yet).** `src/features/auth/sessionStore.ts` gets `getSecureStore()`, `loadSessionSecure()` and `persistSessionSecure()`. If a secure-storage Capacitor plugin is installed (read from `window.Capacitor.Plugins.SecureStoragePlugin`, the `get/set/remove({key,value})` API of `capacitor-secure-storage-plugin`), the session goes to the system store (Android Keystore / iOS Keychain) instead of `localStorage`; an old `localStorage` session is moved into it once and then deleted; if a vault write fails the old storage is used so nobody gets signed out. No plugin installed (today): identical to the old behaviour. Existing functions are unchanged (only the JSON check moved into a shared helper).
- **Tests:** new `tests/sessionSecureStoreTests.ts` (7 tests, added to `npm test`) with a fake plugin and fake `window`: save to vault, one-time migration, clear, vault failure fallback, garbage in vault, no plugin, browser. I ran this file here with plain `node --test`: 7/7 pass, and with the "remove old copy" line deleted one test fails (so it does check that).
- **Part 2 (next step, not done):** use it in `AsisClientShell.tsx`. Needs care: the session loads asynchronously, so the "save on change" effect must not run (and wipe the vault) before the first load finishes, and sign-in must wait for it. Also add the plugin to the CI install list and to `native` setup. I did not pick a plugin version because I cannot check Capacitor 7 compatibility offline.
- Run here: only the new test file, plus `engineTests`, `accountTests`, `lazyScreensTests` (22 pass; 2 failures in this batch are `runTests.ts` failing to import `express`, which is not installed here). NOT run: `tsc`, full `npm test`, build.

## 0.4.17 (step 31)
- **Honest security text.** Code review found that the installed app keeps the session (including the refresh token) in the WebView's `localStorage` (`persistSession` / `loadPersistedSession` in `sessionStore.ts`), while the login screen text (`securityNoteBody`, fa + en) said native builds use Android Keystore / iOS Keychain / Windows DPAPI, and the file comment said tokens are never persisted. Texts and comment now say what the code really does. No behaviour changed; the password itself is still never saved.
- **Still open:** store the session in the system secure store (e.g. a Capacitor secure-storage plugin backed by Android Keystore) instead of `localStorage`. Needs a package install, so it must be done where `npm install` works.
- NOT run here: `tsc`, `npm test`, build (no `node_modules`). Only string/comment edits; no test refers to the old text (grepped).

## 0.4.16 (step 30)
- No app code changed. New `scripts/check.sh` + `npm run check`: install if `node_modules` is missing, then `tsc --noEmit`, `npm test`, `vite build`, stopping at the first failure and printing `ALL OK` at the end. Documented in `TESTING.md`; `TODO-UI.md` step 0 baseline item is now a single command.
- Why: steps 28 and 29 (stats cards, world map) were made without `node_modules` or network, so they have never been type-checked or built. Run `npm run check` once on your machine; if it fails, send me the first error and I fix it.
- NOT run here (same reason). The script itself was only checked with `bash -n`.

## 0.4.15 (step 29)
- **Home** (`src/features/home/HomeView.tsx`, new `src/features/home/WorldMapDots.tsx`): the hero area behind the logo now has a dotted world map (632 dots from coarse continent outlines on a 5-degree grid, one SVG path, glow colour from `--asis-glow-rgb`, faded at the edges, 40% opacity). It is decoration only, not geographic data, and the old glow gradient stays under it.
- `TODO-UI.md`: ticked the world-map item; also ticked two items that were already built but left unticked (Tehran skyline in `LoginScreen.tsx`, connected pill via `StatusBanner` on Home). Left open: step 0 setup items and the 360-430 px / desktop test.
- NOT checked: `tsc --noEmit`, `npm test`, build and the real screen (no `node_modules`, no network, no browser here). If the map looks too strong or too weak, change `opacity-40` on the `WorldMapDots` element in `HomeView.tsx`.

## 0.4.14 (step 28)
- **Statistics screen** (`src/features/statistics/StatisticsView.tsx`): the one-line text summary above the chart is now three small cards in a row: Download, Upload and Total (دانلود / آپلود / مصرف کل), using the same totals the chart already computed (`totalDownloadBytes`, `totalUploadBytes`, `totalBytes`). "Peak" and the axis unit stay as a small line under the cards. Numbers are forced left-to-right so units do not flip in Persian.
- `TODO-UI.md` step 8 item "download / upload cards and total usage" is now ticked.
- NOT checked here: `tsc --noEmit`, `npm test` and the real screen (no `node_modules` and no network in this environment, no browser). Owner test steps: `npm install && npx tsc --noEmit && npm test`, then `npm run dev`, open Statistics with usage data and check the three cards on a 360-430 px width in Persian and English.

## 0.4.13
- Login-first flow: the app now opens on a full-screen sign-in (username/password or subscription link) with a "continue without account" option; the session is kept in the installed app and renewed on launch.
- Mobile-first layout: desktop top bar hidden on phones, new single-column Home screen (status pill, timer, download/upload cards, server card, power button).
- Fonts bundled locally (@fontsource/vazirmatn); Google Fonts link removed (it was render-blocking where Google is unreachable).
- Servers: compact mobile toolbar (smart select, ping test, add, refresh); desktop-only header, policy card and filters hidden on phones.
- Subscriptions / Statistics / Settings: desktop page headers hidden on phones, tighter spacing.
- Account: profile card plus shortcuts to subscriptions, support and API gateway (these are no longer in the phone tab bar).
- Declutter: theme locked to dark/azure (no theme or palette switchers), settings reduced to essentials with "Advanced" collapsed, local-engine stats card and chart-type/source toggles removed, Home reduced to status/transfer/server/power, API gateway removed from navigation, login reduced to one form with a text link for subscription-link sign-in.
- Brand: BrandLogo now uses the official AS neon-ring mark (public/assets/asis-logo.png, cropped from the design); duplicate toggles removed from Advanced settings.
- Brand: icon, adaptive icon, splash, boot splash and in-app logo now generated from the official logo (assets/brand/asis-logo-source.jpg).
