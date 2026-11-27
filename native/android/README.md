# ASiS VPN: Android native integration

How a tap on Connect becomes a tunnel:

1. `HomeView` looks up the full server link (`engine/endpointLinks.ts`) and converts it with `validateAndParseOutbound`.
2. `AsisVpnEngineAdapter.connect` calls `window.AsisNativeBridge.connect(outboundJson, policyJson)`.
3. `engine/nativeBridge.ts` builds the sing-box config (`engine/singBoxConfig.ts`) and calls the Capacitor plugin `AsisVpn`.
4. `AsisVpnPlugin` asks for VPN consent (`VpnService.prepare`), starts `AsisVpnService`, and resolves only when the engine reports Connected (or rejects with an `ENGINE_*` code on error or timeout).
5. `AsisVpnService` runs a `TunnelEngine`. `LibboxTunnelEngine` hands the config to sing-box through `libbox.aar`; `LibboxPlatform` provides the TUN device, socket protection, default network and interface list.

## Layout
- `src/` plugin, service, runtime state, `MainActivity` (copied into the generated Capacitor project)
- `engine-libbox/` real engine. `engine-stub/` fallback that only reports `ENGINE_LIBBOX_MISSING`
- `scripts/build-libbox.sh` builds `libbox.aar` from sing-box (`SING_BOX_REF`, default `v1.11.15`)
- `scripts/install-native.sh` + `patch_android.py` copy the sources and patch the manifest/Gradle (idempotent)

The CI runs these after `cap add android`. If `libbox.aar` cannot be built, or the libbox variant does not compile, it rebuilds with the stub so you still get an APK.

## Status
- Not yet run on a device: VPN consent, real TUN routing, Wi-Fi <-> mobile handoff, per-app split tunneling.
- `LibboxTunnelEngine` / `LibboxPlatform` are written against the libbox API of sing-box 1.11.x. If you change `SING_BOX_REF`, expect to adjust them (the compile error shows up in the CI log before the stub fallback).
- "Connected" means the tunnel is up. The remote server is not probed yet.
- Local engine statistics (bytes, speed) are not read yet; the plugin returns only the session duration.
- App-level Kill Switch is not implemented; use Android's Always-on VPN + "Block connections without VPN".
- No foreground notification yet: Android may stop the service in the background.
- The debug APK gets large because `libbox.aar` ships all ABIs.
