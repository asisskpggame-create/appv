# ASiS VPN — Windows Native Integration Guide

## Stack
- **UI**: WinUI 3 / WPF (.NET 8)
- **VPN Core**: `sing-box.exe` + `wintun.dll` (Wintun Layer-3 TUN driver)
- **Kill Switch**: Windows Filtering Platform (WFP) outbound block rules outside TUN adapter
- **Secret Storage**: Windows DPAPI (`ProtectedData`) / Windows Credential Manager

## Packaging & Verification
1. Bundle signed `sing-box.exe` and `wintun.dll` with SHA-256 integrity verification at launch.
2. Run TUN creation inside a dedicated Windows Service (`NT AUTHORITY\SYSTEM`) communicating with the desktop UI over an ACL-restricted Named Pipe.
3. Verify IPv6 leak protection and DNS routing through the Wintun interface (`netsh interface ip show addresses`).
