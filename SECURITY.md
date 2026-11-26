# ASiS VPN — Security Architecture & Controls

## 1. Non-Negotiable Security Rules

1. **Zero Client-Side Secrets**: PasarGuard admin credentials, reseller service tokens, and JWT signing secrets reside exclusively on the ASiS Client API Gateway (`process.env` / vault), never in mobile, desktop, or browser bundles.
2. **No Plaintext Password Storage**: Passwords are never persisted on clients. Server-side credential hashes use `scrypt` / `Argon2id` where applicable.
3. **Token Lifecycle**:
   - Short-lived access tokens (`10–15 min` TTL).
   - Rotating refresh tokens with reuse detection (revokes token family on replay).
   - Native secure storage: Android Keystore + EncryptedSharedPreferences, iOS Keychain, Windows DPAPI / Credential Manager.
   - Web gateway preview: `Authorization: Bearer` in memory only (never `localStorage`).
4. **Configuration Injection Prevention**:
   - Every parsed VLESS/VMess/Trojan/WireGuard/Hysteria2/TUIC config undergoes strict schema validation before passing to `sing-box` JSON generation.
   - Untrusted subscription payloads cannot inject `experimental`, `clash_api`, `route.rules` overrides, or arbitrary `dns` hijacks.
5. **SSRF Defense on Manual Subscription Import**:
   - Gateway URL fetcher strictly permits `https:` (or `http:` only if explicitly configured), blocks loopback/private/link-local CIDRs (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`), disables unsafe redirects, and redacts subscription URLs from logs and analytics.
6. **Authoritative Usage**: Client-measured byte counters are never sent to the server as billing truth.
