import { validateAndParseOutbound } from './protocolValidator.ts';
import type {
  AdvancedConnectionPolicy,
  ConnectionState,
  EngineDiagnosticReport,
  EngineValidationResult,
  InstalledAppEntry,
  LocalEngineStatistics,
  NativeProbeResult,
  NativeProbeTarget,
  SanitizedOutboundConfig,
  TargetPlatform,
  TunnelStatus,
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
      getTunnelStatus?: () => Promise<TunnelStatus>;
      runTunnelTest?: () => Promise<TunnelStatus>;
      tcpProbe?: (targets: NativeProbeTarget[], timeoutMs: number) => Promise<NativeProbeResult[]>;
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
    return this.connectAny([outbound], policy);
  }

  async connectGroup(outbounds: SanitizedOutboundConfig[], policy: AdvancedConnectionPolicy): Promise<void> {
    return this.connectAny(outbounds, policy);
  }

  async getTunnelStatus(): Promise<TunnelStatus | null> {
    if (typeof window === 'undefined' || typeof window.AsisNativeBridge?.getTunnelStatus !== 'function') return null;
    return window.AsisNativeBridge.getTunnelStatus();
  }

  async runTunnelTest(): Promise<TunnelStatus | null> {
    if (typeof window === 'undefined' || typeof window.AsisNativeBridge?.runTunnelTest !== 'function') return null;
    return window.AsisNativeBridge.runTunnelTest();
  }

  /**
   * Guards against overlapping connects (auto-connect, auto-switch and a tap can race):
   * the SAME request while one is running shares that attempt (one native connect, not two);
   * a DIFFERENT request waits for the running one to finish, then runs (the native side
   * handles it as a switch). A failed attempt never blocks the next one.
   */
  private inFlight: { key: string; promise: Promise<void> } | null = null;
  private connectChain: Promise<void> = Promise.resolve();

  private connectAny(outbounds: SanitizedOutboundConfig[], policy: AdvancedConnectionPolicy): Promise<void> {
    const key = JSON.stringify([outbounds.map((o) => o.singBoxOutbound), policy]);
    if (this.inFlight?.key === key) return this.inFlight.promise;
    const run = this.connectChain.catch(() => undefined).then(() => this.connectNow(outbounds, policy));
    this.connectChain = run;
    const entry = { key, promise: run };
    this.inFlight = entry;
    const clear = () => {
      if (this.inFlight === entry) this.inFlight = null;
    };
    run.then(clear, clear);
    return run;
  }

  private async connectNow(outbounds: SanitizedOutboundConfig[], policy: AdvancedConnectionPolicy): Promise<void> {
    const outbound = outbounds[0];
    this.currentOutbound = outbound;
    this.state = 'Preparing';
    this.lastErrorCode = null;
    this.lastErrorMessage = null;

    if (typeof window !== 'undefined' && window.AsisNativeBridge) {
      this.state = 'Connecting';
      try {
        await window.AsisNativeBridge.connect(
          JSON.stringify(
            outbounds.length === 1 ? outbound.singBoxOutbound : outbounds.map((o) => o.singBoxOutbound),
          ),
          JSON.stringify(policy),
        );
        const confirmedState = await window.AsisNativeBridge.getState();
        this.state = confirmedState;
        return;
      } catch (err) {
        this.state = 'Error';
        const nativeCode = (err as { code?: unknown } | null)?.code;
        this.lastErrorCode =
          typeof nativeCode === 'string' && nativeCode.startsWith('ENGINE_')
            ? nativeCode
            : 'ENGINE_NATIVE_CONNECT_FAILED';
        const nativeMessage = (err as { message?: unknown } | null)?.message;
        this.lastErrorMessage =
          typeof nativeMessage === 'string' && nativeMessage ? nativeMessage : 'Native VPN connection failed.';
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
