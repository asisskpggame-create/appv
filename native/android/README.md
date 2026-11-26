# ASiS VPN — Android Native Integration Guide

## Stack
- **Language**: Kotlin + Jetpack Compose
- **VPN Core**: `sing-box` compiled to `libbox.aar` via `gomobile`
- **OS API**: `android.net.VpnService` + `EncryptedSharedPreferences` / Android Keystore

## Build & Verification Steps
1. Open in Android Studio (AGP 8.x+, `minSdk 24`, `targetSdk 35`).
2. Compile `libbox.aar` from pinned `sing-box` release tag and place in `app/libs/libbox.aar`.
3. Declare `<service android:name=".engine.AsisVpnService" android:permission="android.permission.BIND_VPN_SERVICE" android:exported="false">` in `AndroidManifest.xml`.
4. Request user tunnel authorization via `VpnService.prepare(context)` before starting `AsisVpnService`.
5. Store access/refresh tokens exclusively in `EncryptedSharedPreferences` backed by `MasterKey`.
6. Verify real TUN routing, Wi-Fi ↔ 5G handoff, per-app split tunneling, and Kill Switch (`Always-on VPN` / `Block connections without VPN`) on physical hardware.
