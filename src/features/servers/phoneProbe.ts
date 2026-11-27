import type { NativeProbeResult, NativeProbeTarget } from '../../engine';

export function isPhoneProbeAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.AsisNativeBridge?.tcpProbe === 'function';
}

/**
 * Measures TCP handshake time from this device to each host:port using the native app.
 * On Android the sockets are bound to the physical network, so the numbers describe the
 * phone -> server path even while the VPN is connected.
 * Returns null when the native probe is unavailable or failed as a whole: the caller then
 * falls back to the gateway probe. Never returns invented numbers.
 */
export async function probeFromPhone(
  targets: NativeProbeTarget[],
  timeoutMs = 4000,
): Promise<NativeProbeResult[] | null> {
  if (!isPhoneProbeAvailable() || targets.length === 0) return null;
  try {
    const raw = await window.AsisNativeBridge!.tcpProbe!(targets, timeoutMs);
    if (!Array.isArray(raw)) return null;
    const wanted = new Set(targets.map((t) => t.id));
    const out: NativeProbeResult[] = [];
    for (const item of raw) {
      if (!item || typeof item.id !== 'string' || !wanted.has(item.id)) continue;
      const ok = item.available === true && typeof item.latencyMs === 'number' && Number.isFinite(item.latencyMs) && item.latencyMs >= 0;
      out.push({
        id: item.id,
        available: ok,
        latencyMs: ok ? Math.round(item.latencyMs as number) : null,
        ...(ok ? {} : { error: typeof item.error === 'string' ? item.error : 'unreachable' }),
      });
    }
    return out;
  } catch {
    return null;
  }
}
