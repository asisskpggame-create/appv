import type { ConnectionState } from '../../engine/types.ts';

/**
 * Auto-connect on app open (policy.autoConnect, default off).
 *
 * Rules, all decided here so they can be tested without a UI:
 *  - only once per app launch (cold start), never again when the app returns from the background;
 *  - only after the user has connected successfully on this device before, so the very first
 *    connection (and its system VPN-permission dialog) is always an explicit user action;
 *  - never when the user already picked a server / pressed Connect during this launch;
 *  - never while the engine or the native service is already connecting / connected;
 *  - only when the full server link is available (it is memory-only and comes back with account sync).
 */

const LAST_SERVER_KEY = 'asis_last_server_v1';
const VPN_CONSENT_KEY = 'asis_vpn_consent_v1';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or full: auto-connect simply stays dormant.
  }
}

export function loadLastServerId(): string | null {
  const id = readStorage(LAST_SERVER_KEY);
  return id && id.length > 0 ? id : null;
}

export function saveLastServerId(id: string): void {
  writeStorage(LAST_SERVER_KEY, id);
}

/** Called after a real `Connected` state: the OS VPN permission has been granted on this device. */
export function markVpnConsentGranted(): void {
  writeStorage(VPN_CONSENT_KEY, '1');
}

export function hasVpnConsent(): boolean {
  return readStorage(VPN_CONSENT_KEY) === '1';
}

export type AutoConnectDecision = 'connect' | 'wait' | 'skip';

export interface AutoConnectInput {
  enabled: boolean;
  /** Still armed for this app launch (not yet consumed by the user or an earlier attempt). */
  pending: boolean;
  connState: ConnectionState;
  hasConsent: boolean;
  nativeAvailable: boolean;
  /** The server to connect to has been resolved from the catalog. */
  serverResolved: boolean;
  /** The full link for that server is in memory. */
  hasLink: boolean;
}

/**
 * `connect`: go now. `wait`: conditions may still arrive (account sync, server list), keep armed.
 * `skip`: give up for this launch.
 */
export function decideAutoConnect(input: AutoConnectInput): AutoConnectDecision {
  if (!input.enabled || !input.pending) return 'skip';
  if (!input.nativeAvailable || !input.hasConsent) return 'skip';
  if (input.connState !== 'Disconnected') return 'skip';
  if (!input.serverResolved) return 'wait';
  return input.hasLink ? 'connect' : 'skip';
}

/** Real state of the native service, or null when it cannot be read (browser, bridge error). */
export async function readNativeState(): Promise<ConnectionState | null> {
  try {
    const bridge = (window as unknown as { AsisNativeBridge?: { getState?: () => Promise<ConnectionState> } })
      .AsisNativeBridge;
    if (typeof bridge?.getState !== 'function') return null;
    return await bridge.getState();
  } catch {
    return null;
  }
}

/** The native service can outlive the web view: never start a second tunnel on top of it. */
export async function nativeTunnelAlreadyActive(): Promise<boolean> {
  try {
    const bridge = (window as unknown as { AsisNativeBridge?: { getState?: () => Promise<ConnectionState> } })
      .AsisNativeBridge;
    if (typeof bridge?.getState !== 'function') return false;
    const state = await bridge.getState();
    return state === 'Connected' || state === 'Connecting' || state === 'Preparing' || state === 'Reconnecting';
  } catch {
    // Cannot tell: do not connect behind the user's back.
    return true;
  }
}
