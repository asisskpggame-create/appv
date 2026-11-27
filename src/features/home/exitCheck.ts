import type { ServerCatalogEntry } from '../servers';

export interface ExitInfo {
  ip: string;
  /** ISO 3166-1 alpha-2, upper-case; null when the provider only returned an IP. */
  countryCode: string | null;
  source: 'ipwho.is' | 'country.is' | 'ipify';
}

export type ExitCheckStatus =
  /** Measured exit country matches what the selected server promises. */
  | 'ok'
  /** Exit IP is Iranian although the server should exit abroad: not tunnelled / tunnel broken. */
  | 'leak'
  /** Exit is abroad but in a different country than the server claims. */
  | 'mismatch'
  /** Not enough information (no country from provider or server has no country). */
  | 'unknown';

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

async function getJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Asks public IP services which address and country the internet sees for this device.
 * Tries providers in order; the last one only returns the IP. Returns null if all fail.
 */
export async function fetchExitInfo(timeoutMs = 4000): Promise<ExitInfo | null> {
  const a = await getJson('https://ipwho.is/', timeoutMs);
  if (a && a.success !== false && typeof a.ip === 'string') {
    return { ip: a.ip, countryCode: normalizeCode(a.country_code), source: 'ipwho.is' };
  }
  const b = await getJson('https://api.country.is/', timeoutMs);
  if (b && typeof b.ip === 'string') {
    return { ip: b.ip, countryCode: normalizeCode(b.country), source: 'country.is' };
  }
  const c = await getJson('https://api.ipify.org?format=json', timeoutMs);
  if (c && typeof c.ip === 'string') {
    return { ip: c.ip, countryCode: null, source: 'ipify' };
  }
  return null;
}

/**
 * Compares the measured exit with the selected server. For tunnel servers
 * `server.countryCode` is the EXIT country, so an Iranian IP means the tunnel is not carrying traffic.
 */
export function evaluateExit(
  server: Pick<ServerCatalogEntry, 'countryCode'> | null,
  exit: ExitInfo | null,
): ExitCheckStatus {
  const expected = normalizeCode(server?.countryCode);
  const actual = exit?.countryCode ?? null;
  if (!expected || !actual) return 'unknown';
  if (actual === expected) return 'ok';
  if (actual === 'IR') return 'leak';
  return 'mismatch';
}
