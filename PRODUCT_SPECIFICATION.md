# ASiS VPN — Product Specification

## 1. Product Identity

- **Name**: ASiS VPN
- **Category**: Commercial Multi-Platform End-User VPN Client
- **Target Platforms**: Android, iOS, Windows
- **Supported Languages**:
  - English (`en-US`) — Complete LTR layout
  - Persian (`fa-IR`) — Complete RTL layout
- **Themes**: Light Mode & Dark Mode

## 2. Brand Palette

| Token | Hex | Role |
|---|---|---|
| Primary | `#087BFF` | Primary actions, active connection ring, brand emphasis |
| Secondary | `#EAF3FF` | Soft blue surface tint in light mode |
| Background | `#FFFFFF` | Primary light canvas |
| Primary Text | `#0E1428` | High-contrast ink on light canvas |
| Secondary Text | `#64748B` | Muted metadata, labels, secondary descriptions |
| Accent | `#1684FF` | Hover states, dark-mode primary action |

## 3. Core Functional Modules

1. **Authentication**: Username + password login via gateway JWT access/refresh tokens, device registration, session revocation, suspension handling, and existing password recovery workflow.
2. **Subscriptions**:
   - Method A: Automatic synchronization of account subscriptions from PasarGuard & Reseller adapters.
   - Method B: Manual import (URL, clipboard, QR code, file) with duplicate detection, validation, and secure storage.
3. **VPN Engine Abstraction**: Protocol-agnostic interface supporting `sing-box` and native protocol engines, with explicit unsupported markers where a platform or engine lacks support.
4. **Connection Management**: Deterministic state machine (`Disconnected`, `Preparing`, `Connecting`, `Connected`, `Reconnecting`, `Disconnecting`, `Error`), network transitions, and diagnostics.
5. **Server Catalog & Smart Connect**: Real-measurement latency testing, country/protocol filtering, favorites, recents, and policy-driven best-server selection.
6. **Traffic & Statistics**: Clear separation of Local Engine counters vs. Authoritative Server-Side Subscription balances.
7. **Advanced Settings**: Platform-gated Kill Switch, Split Tunneling, DNS, IPv4/IPv6, MTU, Routing Mode, and Proxy settings.
8. **Updates & Support**: Version gating (mandatory/optional updates), FAQ, troubleshooting, and diagnostics submission.
