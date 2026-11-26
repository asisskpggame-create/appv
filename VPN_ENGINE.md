# VPN Engine Abstraction Specification

## 1. Core Principle

The ASiS VPN UI never invokes `sing-box`, `NetworkExtension`, `VpnService`, or `Wintun` directly. All platforms implement a unified `VpnEngineAdapter` contract so engines can be upgraded or swapped per protocol without UI rewrites.

## 2. Engine Interface Contract

- `initialize(platformContext)`
- `validateConfiguration(config): ValidationResult`
- `connect(outboundConfig, networkPolicy)`
- `disconnect()`
- `restart()`
- `getConnectionState(): ConnectionState` (`Disconnected | Preparing | Connecting | Connected | Reconnecting | Disconnecting | Error`)
- `getConnectionStatistics(): LocalEngineStats` (clearly separated from server-side billing)
- `getCurrentOutbound(): OutboundDescriptor | null`
- `getDiagnostics(): DiagnosticSnapshot`
- `onNetworkChange(networkEvent)`
- `cleanup()`

## 3. Protocol Support Matrix (Planned)

| Protocol | Primary Engine | Android | iOS | Windows | Web Preview |
|---|---|---|---|---|---|
| VLESS (TCP/WS/gRPC) | `sing-box` | Native Required | Native Required | Native Required | Unsupported (UI/Parser only) |
| VLESS + Reality | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| VLESS + TLS | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| VMess | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| Trojan | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| Shadowsocks | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| WireGuard | `sing-box` / WG Native | Native Required | Native Required | Native Required | Unsupported |
| Hysteria2 | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| TUIC | `sing-box` | Native Required | Native Required | Native Required | Unsupported |
| SOCKS / HTTP Proxy | `sing-box` / OS Proxy | Native Required | Native Required | Native Required | Unsupported |
| OpenVPN | Dedicated OpenVPN Adapter | Optional Native | Optional Native | Optional Native | Unsupported |
| IKEv2 | OS Native (`NEVPNManager` / Windows RAS) | Unsupported / OEM | Native IKEv2 | Native RAS | Unsupported |

**Strict Rule**: Any protocol lacking a verified parser, validator, and platform engine implementation must be surfaced as `UNSUPPORTED` in the UI—never faked.
