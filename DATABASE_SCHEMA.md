# ASiS VPN — Database & Local Storage Schema Specification

## 1. Backend Gateway Entities (PostgreSQL + Redis Target / Gateway Store)

- **`UserAccount`**: `id`, `username`, `resellerCustomerId`, `status` (`active | suspended | disabled`), `createdAt`, `updatedAt`
- **`Device`**: `id`, `userId`, `deviceName`, `platform` (`android | ios | windows | web`), `appVersion`, `lastSeenAt`, `revokedAt`
- **`UserSession`**: `id`, `userId`, `deviceId`, `refreshTokenHash`, `tokenFamilyId`, `expiresAt`, `revokedAt`
- **`Subscription`**: `id`, `userId`, `providerInstanceId`, `externalSubId`, `name`, `type` (`time | traffic | combined | unlimited | trial | custom`), `totalBytes`, `usedBytes`, `remainingBytes`, `startsAt`, `expiresAt`, `status`, `allowedDevices`, `lastSyncedAt`
- **`ImportedSubscription`**: `id`, `userId`, `label`, `urlHash` (SHA-256 for deduplication), `encryptedSourceUrl` (AES-256-GCM at rest), `lastSyncedAt`, `status`
- **`LinkedAccount`** (`linked_accounts` in the SQLite gateway store): `userId` (`pg:<instance>:<username>`), `instanceId`, `username`, `subscriptionToken` (AES-256-GCM at rest), `updatedAt`
- **`LocalAccount`** (`local_accounts`): `username` (lowercase, PK), `passwordHash` (`scrypt$N$r$p$salt$hash`), `subscriptionUrl` (AES-256-GCM at rest), `failedAttempts`, `lockedAt`, `lastLoginAt`, `createdAt`, `updatedAt`. Locked when `failedAttempts >= 3`; only the admin API clears it.
- **`ServerGroup` & `Server`**: `id`, `subscriptionId`, `countryCode`, `city`, `name`, `protocols[]`, `isAvailable`, `lastProbedAt`
- **`UsageSnapshot`**: `id`, `subscriptionId`, `source` (`server_authoritative`), `usedBytes`, `recordedAt`
- **`DiagnosticReport`**: `id`, `userId`, `deviceId`, `errorCode`, `category`, `redactedContext`, `createdAt`

## 2. Client Local Storage Split

- **Secure Storage (Keystore / Keychain / DPAPI)**: Access token (memory + refresh token in secure vault), device keypair.
- **Local Database (SQLite / Room / SwiftData)**: Non-sensitive cached server catalog, favorites, recent servers, local session history, and `AppSettings` (theme, language, DNS preference, routing mode).
- **Explicitly Excluded**: Raw PasarGuard panel credentials, unencrypted sensitive tokens, and raw unredacted subscription URLs in diagnostic logs.
