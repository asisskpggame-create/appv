# ASiS VPN — iOS Native Integration Guide

## Stack
- **Language**: Swift + SwiftUI
- **VPN Core**: `Libbox.xcframework` (`sing-box` for iOS)
- **OS API**: `NetworkExtension` (`NEPacketTunnelProvider`, `NETunnelProviderManager`) + Keychain + App Groups

## Entitlements & Memory Rules
1. Enable **Personal VPN**, **Network Extensions (Packet Tunnel)**, and **App Groups** (`group.com.asisvpn.client`) in Xcode for both the main app target and the Packet Tunnel Extension target.
2. Enforce strict memory discipline (`<= 50 MB` extension limit): disable excessive GeoIP/RuleSet in-memory caches inside the extension.
3. Persist JWT refresh tokens only in iOS Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
4. Note platform limitation: Per-app split tunneling is not available to non-MDM consumer iOS apps (`NEPacketTunnelProvider` routes device-wide or via `excludedRoutes` IP CIDRs).
