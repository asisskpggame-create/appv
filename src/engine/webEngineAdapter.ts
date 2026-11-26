import { validateAndParseOutbound } from './protocolValidator.ts';
import type {
  AdvancedConnectionPolicy,
  ConnectionState,
  EngineDiagnosticReport,
  EngineValidationResult,
  InstalledAppEntry,
  LocalEngineStatistics,
  SanitizedOutboundConfig,
  TargetPlatform,
  VpnEngineAdapter,
} from './types.ts';

declare global {
  interface Window {
    AsisNativeBridge?: {
      platform: 'android' | 'ios' | 'windows';
      connect(outboundJson: string, policyJson: string): Promise<void>;
      disconnect(): Promise<void>;
      getState(): Promise<ConnectionState>;
      getStats(): Promise<LocalEngineStatistics>;
      getInstalledApplications?: () => Promise<InstalledAppEntry[]>;
    };
  }
}

export class EngineRuntimeError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineRuntimeError';
    this.code = code;
  }
}

export function detectRuntimePlatform(): TargetPlatform {
  if (typeof window !== 'undefined' && window.AsisNativeBridge?.platform) {
    return window.AsisNativeBridge.platform;
  }
  return 'web';
}

/**
 * Web & Native-Bridge VPN Engine Adapter.
 * - If running inside an Android/iOS/Windows native shell injecting window.AsisNativeBridge, delegates to the real OS VPN engine.
 * - If running in a standard web browser, validates configs strictly and refuses to simulate a fake VPN tunnel.
 */
export class AsisVpnEngineAdapter implements VpnEngineAdapter {
  public readonly engineId = 'asis-sing-box-adapter';
  public readonly platform: TargetPlatform;
  private state: ConnectionState = 'Disconnected';
  private currentOutbound: SanitizedOutboundConfig | null = null;
  private lastErrorCode: string | null = null;
  private lastErrorMessage: string | null = null;

  constructor(platform?: TargetPlatform) {
    this.platform = platform ?? detectRuntimePlatform();
  }

  async initialize(): Promise<void> {
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
  }

  validateConfiguration(rawConfigOrUri: string): EngineValidationResult {
    return validateAndParseOutbound(rawConfigOrUri, this.platform);
  }

  async connect(outbound: SanitizedOutboundConfig, policy: AdvancedConnectionPolicy): Promise<void> {
    this.currentOutbound = outbound;
    this.state = 'Preparing';
    this.lastErrorCode = null;
    this.lastErrorMessage = null;

    if (typeof window !== 'undefined' && window.AsisNativeBridge) {
      this.state = 'Connecting';
      try {
        await window.AsisNativeBridge.connect(
          JSON.stringify(outbound.singBoxOutbound),
          JSON.stringify(policy),
        );
        const confirmedState = await window.AsisNativeBridge.getState();
        this.state = confirmedState;
        return;
      } catch (err) {
        this.state = 'Error';
        this.lastErrorCode = 'ENGINE_NATIVE_CONNECT_FAILED';
        this.lastErrorMessage = err instanceof Error ? err.message : 'Native VPN connection failed.';
        throw new EngineRuntimeError(this.lastErrorCode, this.lastErrorMessage);
      }
    }

    // Standard browser environment: NEVER fake a Connected tunnel state.
    this.state = 'Error';
    this.lastErrorCode = 'ENGINE_UNSUPPORTED_IN_BROWSER';
    this.lastErrorMessage =
      'Real TUN VPN tunnels require the native Android (VpnService), iOS (NEPacketTunnelProvider), or Windows (Wintun + sing-box) client.';
    throw new EngineRuntimeError(this.lastErrorCode, this.lastErrorMessage);
  }

  async disconnect(): Promise<void> {
    if (typeof window !== 'undefined' && window.AsisNativeBridge) {
      this.state = 'Disconnecting';
      await window.AsisNativeBridge.disconnect();
    }
    this.state = 'Disconnected';
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
  }

  async restart(): Promise<void> {
    await this.disconnect();
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  getConnectionStatistics(): LocalEngineStatistics {
    return {
      source: 'local_engine',
      downloadSpeedBps: null,
      uploadSpeedBps: null,
      sessionDownloadBytes: 0,
      sessionUploadBytes: 0,
      sessionDurationSec: 0,
    };
  }

  getCurrentOutbound(): SanitizedOutboundConfig | null {
    return this.currentOutbound;
  }

  getDiagnostics(): EngineDiagnosticReport {
    return {
      engineName: this.engineId,
      platform: this.platform,
      state: this.state,
      nativeBridgeAvailable: typeof window !== 'undefined' && Boolean(window.AsisNativeBridge),
      lastErrorCode: this.lastErrorCode,
      lastErrorMessage: this.lastErrorMessage,
      checkedAt: new Date().toISOString(),
    };
  }

  async getInstalledApplications(): Promise<InstalledAppEntry[]> {
    if (
      typeof window !== 'undefined' &&
      typeof window.AsisNativeBridge?.getInstalledApplications === 'function'
    ) {
      return window.AsisNativeBridge.getInstalledApplications();
    }
    return [];
  }

  async handleNetworkChange(
    networkType: 'wifi' | 'cellular' | 'ethernet' | 'offline',
  ): Promise<void> {
    if (networkType === 'offline' && this.state === 'Connected') {
      this.state = 'Reconnecting';
    }
  }

  async cleanup(): Promise<void> {
    this.state = 'Disconnected';
    this.currentOutbound = null;
  }
}
