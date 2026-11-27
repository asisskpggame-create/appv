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
