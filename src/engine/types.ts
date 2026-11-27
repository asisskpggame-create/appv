export type ConnectionState =
  | 'Disconnected'
  | 'Preparing'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting'
  | 'Disconnecting'
  | 'Error';

export type EngineProtocol =
  | 'VLESS'
  | 'VLESS + Reality'
  | 'VLESS + TLS'
  | 'VMess'
  | 'Trojan'
  | 'Shadowsocks'
  | 'WireGuard'
  | 'Hysteria2'
  | 'TUIC'
  | 'SOCKS'
  | 'HTTP Proxy'
  | 'OpenVPN'
  | 'IKEv2';

export type TargetPlatform = 'android' | 'ios' | 'windows' | 'web';

export interface ProtocolSupportEntry {
  protocol: EngineProtocol;
  engine: 'sing-box' | 'native_os' | 'dedicated_adapter' | 'unsupported';
  supportedPlatforms: TargetPlatform[];
  webRuntimeSupported: boolean;
  notes: string;
}

export interface SanitizedOutboundConfig {
  id: string;
  tag: string;
  protocol: EngineProtocol;
  serverRedacted: string;
  port: number;
  transport: string;
  tlsSecurity: 'none' | 'tls' | 'reality';
  /** Raw sing-box compatible outbound AST (excludes experimental/clash_api overrides) */
  singBoxOutbound: Record<string, unknown>;
}

export interface EngineValidationResult {
  valid: boolean;
  protocol: EngineProtocol | 'UNKNOWN';
  supportedOnCurrentPlatform: boolean;
  errors: string[];
  outbound?: SanitizedOutboundConfig;
}

export interface LocalEngineStatistics {
  source: 'local_engine';
  downloadSpeedBps: number | null;
  uploadSpeedBps: number | null;
  sessionDownloadBytes: number;
  sessionUploadBytes: number;
  sessionDurationSec: number;
}

export interface EngineDiagnosticReport {
  engineName: string;
  platform: TargetPlatform;
  state: ConnectionState;
  nativeBridgeAvailable: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  checkedAt: string;
}

export interface NativeProbeTarget {
  id: string;
  host: string;
  port: number;
}

export interface NativeProbeResult {
  id: string;
  /** TCP handshake time in ms; null when the connection failed. */
  latencyMs: number | null;
  available: boolean;
  error?: string;
}

export interface TunnelStatus {
  /** false when the core's local controller cannot be reached; delays are then empty. */
  available: boolean;
  /** Tag of the outbound carrying traffic: 'proxy' (single server) or 'node-N' (auto-switch group). */
  active: string | null;
  /** Last measured end-to-end delay in ms per tag (through the tunnel); null = test failed. */
  delays: Record<string, number | null>;
}

export type SplitTunnelingRuleMode = 'exclude_selected' | 'include_selected';

export type InstalledAppCategory =
  | 'browser'
  | 'messaging'
  | 'media'
  | 'developer'
  | 'system'
  | 'other';

export interface InstalledAppEntry {
  id: string;
  name: string;
  identifier: string;
  category: InstalledAppCategory;
  isSystemApp?: boolean;
  source: 'native_bridge' | 'custom_entry';
}

export interface AdvancedConnectionPolicy {
  killSwitch: boolean;
  splitTunnelingMode: 'all' | 'bypass_lan' | 'bypass_iran' | 'custom';
  splitTunnelingRuleMode: SplitTunnelingRuleMode;
  splitTunnelingAppIds: string[];
  customDns: string;
  ipv6Mode: 'disable' | 'auto' | 'prefer';
  mtu: number;
  autoReconnect: boolean;
  /** Connect to a group of servers and let sing-box's urltest pick the fastest. Default off. */
  autoSwitch?: boolean;
  /** Connect automatically when the app is opened (once per launch, after a first manual connection). Default off. */
  autoConnect?: boolean;
  connectionTimeoutSec: number;
  protocolPreference: 'auto' | EngineProtocol;
  routingMode: 'rule' | 'global';
  allowLocalNetwork: boolean;
  localSocksPort: number;
  localHttpPort: number;
}

export interface VpnEngineAdapter {
  readonly engineId: string;
  readonly platform: TargetPlatform;
  initialize(): Promise<void>;
  validateConfiguration(rawConfigOrUri: string): EngineValidationResult;
  connect(outbound: SanitizedOutboundConfig, policy: AdvancedConnectionPolicy): Promise<void>;
  /** Auto-switch: 2+ servers, the core's urltest group chooses and re-chooses the fastest. */
  connectGroup?(outbounds: SanitizedOutboundConfig[], policy: AdvancedConnectionPolicy): Promise<void>;
  /** Reads the latest tunnel latency results; null when not supported (browser). */
  getTunnelStatus?(): Promise<TunnelStatus | null>;
  /** Forces a fresh test through the tunnel, then returns the status. */
  runTunnelTest?(): Promise<TunnelStatus | null>;
  disconnect(): Promise<void>;
  restart(): Promise<void>;
  getConnectionState(): ConnectionState;
  getConnectionStatistics(): LocalEngineStatistics;
  getCurrentOutbound(): SanitizedOutboundConfig | null;
  getDiagnostics(): EngineDiagnosticReport;
  handleNetworkChange(networkType: 'wifi' | 'cellular' | 'ethernet' | 'offline'): Promise<void>;
  cleanup(): Promise<void>;
}
