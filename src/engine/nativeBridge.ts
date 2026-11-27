import { buildSingBoxConfig, ConfigBuildError } from './singBoxConfig.ts';
import type {
  AdvancedConnectionPolicy,
  ConnectionState,
  InstalledAppEntry,
  LocalEngineStatistics,
  NativeProbeResult,
  NativeProbeTarget,
  TunnelStatus,
} from './types.ts';

/** Shape of the Capacitor plugin implemented in native/android (AsisVpnPlugin.java). */
interface AsisVpnPlugin {
  connect(options: { config: string; timeoutSec: number }): Promise<void>;
  disconnect(): Promise<void>;
  getState(): Promise<{ state: ConnectionState; errorCode?: string | null; errorMessage?: string | null }>;
  getStats(): Promise<{ sessionDurationSec: number }>;
  getInstalledApplications(): Promise<{ apps: InstalledAppEntry[] }>;
  tcpProbe(options: { targets: NativeProbeTarget[]; timeoutMs: number }): Promise<{ results: NativeProbeResult[] }>;
  getTunnelStatus(): Promise<TunnelStatus>;
  runTunnelTest(): Promise<TunnelStatus>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
  registerPlugin?: (name: string) => unknown;
}

const PLUGIN_NAME = 'AsisVpn';

function findPlugin(cap: CapacitorGlobal): AsisVpnPlugin | null {
  const existing = cap.Plugins?.[PLUGIN_NAME];
  if (existing) return existing as AsisVpnPlugin;
  try {
    return (cap.registerPlugin?.(PLUGIN_NAME) as AsisVpnPlugin | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Random loopback controller so the app can read urltest results; the secret never leaves the device. */
function randomController(): { port: number; secret: string } {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  const port = 20000 + (((bytes[0] << 8) | bytes[1]) % 40000);
  const secret = Array.from(bytes.slice(4), (b) => b.toString(16).padStart(2, '0')).join('');
  return { port, secret };
}

function parseJsonValue(label: string, text: string): Record<string, unknown> | Array<Record<string, unknown>> {
  try {
    const value = JSON.parse(text) as unknown;
    if (Array.isArray(value) && value.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
      return value as Array<Record<string, unknown>>;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ConfigBuildError('ENGINE_INVALID_INPUT', `${label} is not valid JSON.`);
}

function parseJson(label: string, text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ConfigBuildError('ENGINE_INVALID_INPUT', `${label} is not valid JSON.`);
}

/**
 * Installs `window.AsisNativeBridge` when running inside the Android app.
 * Returns true if the bridge was installed. Does nothing in a normal browser.
 */
export function installNativeBridge(
  win: (Window & { Capacitor?: CapacitorGlobal }) | undefined = typeof window === 'undefined'
    ? undefined
    : (window as Window & { Capacitor?: CapacitorGlobal }),
): boolean {
  const cap = win?.Capacitor;
  if (!win || !cap || cap.isNativePlatform?.() !== true || cap.getPlatform?.() !== 'android') return false;
  if (win.AsisNativeBridge) return true;
  const plugin = findPlugin(cap);
  if (!plugin) return false;

  win.AsisNativeBridge = {
    platform: 'android',
    async connect(outboundJson: string, policyJson: string): Promise<void> {
      // One server object, or an array of servers for auto-switch (urltest group).
      const outbound = parseJsonValue('Outbound', outboundJson);
      const policy = parseJson('Policy', policyJson) as unknown as AdvancedConnectionPolicy;
      const { config } = buildSingBoxConfig(outbound, policy, { controller: randomController() });
      await plugin.connect({
        config: JSON.stringify(config),
        timeoutSec: Number.isFinite(policy.connectionTimeoutSec) ? policy.connectionTimeoutSec : 15,
      });
    },
    async disconnect(): Promise<void> {
      await plugin.disconnect();
    },
    async getState(): Promise<ConnectionState> {
      return (await plugin.getState()).state;
    },
    async getStats(): Promise<LocalEngineStatistics> {
      const { sessionDurationSec } = await plugin.getStats();
      // Byte counters and speeds are not read from the engine yet: null/0, never invented.
      return {
        source: 'local_engine',
        downloadSpeedBps: null,
        uploadSpeedBps: null,
        sessionDownloadBytes: 0,
        sessionUploadBytes: 0,
        sessionDurationSec,
      };
    },
    async getInstalledApplications(): Promise<InstalledAppEntry[]> {
      return (await plugin.getInstalledApplications()).apps;
    },
    async getTunnelStatus(): Promise<TunnelStatus> {
      return plugin.getTunnelStatus();
    },
    async runTunnelTest(): Promise<TunnelStatus> {
      return plugin.runTunnelTest();
    },
    async tcpProbe(targets: NativeProbeTarget[], timeoutMs: number): Promise<NativeProbeResult[]> {
      return (await plugin.tcpProbe({ targets, timeoutMs })).results;
    },
  };
  return true;
}
