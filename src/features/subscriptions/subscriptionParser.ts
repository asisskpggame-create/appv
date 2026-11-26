import type { ParsedEndpointSummary, SubscriptionType } from './types';

const SUPPORTED_URI_SCHEMES = new Map<string, { protocol: string; supported: boolean }>([
  ['vless', { protocol: 'VLESS', supported: true }],
  ['vmess', { protocol: 'VMess', supported: true }],
  ['trojan', { protocol: 'Trojan', supported: true }],
  ['ss', { protocol: 'Shadowsocks', supported: true }],
  ['hysteria2', { protocol: 'Hysteria2', supported: true }],
  ['hy2', { protocol: 'Hysteria2', supported: true }],
  ['tuic', { protocol: 'TUIC', supported: true }],
  ['wg', { protocol: 'WireGuard', supported: true }],
  ['wireguard', { protocol: 'WireGuard', supported: true }],
  ['socks', { protocol: 'SOCKS', supported: true }],
  ['socks5', { protocol: 'SOCKS', supported: true }],
  ['http', { protocol: 'HTTP Proxy', supported: true }],
  ['openvpn', { protocol: 'OpenVPN', supported: false }],
  ['ikev2', { protocol: 'IKEv2', supported: false }],
]);

export function validateManualSubscriptionUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl?: string;
  errorKey?: 'empty' | 'malformed' | 'insecure_scheme' | 'blocked_host';
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, errorKey: 'empty' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, errorKey: 'malformed' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, errorKey: 'insecure_scheme' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    !host.includes('.') ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return { valid: false, errorKey: 'blocked_host' };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

export async function computeFingerprintSha256(input: string): Promise<string> {
  const normalized = input.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback hash only if SubtleCrypto is unavailable
  let acc = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    acc ^= normalized.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return `fnv_${(acc >>> 0).toString(16)}`;
}

function redactHost(host: string): string {
  if (!host) return '***';
  if (host.length <= 6) return '***';
  return `${host.slice(0, 3)}***${host.slice(-3)}`;
}

function tryDecodeBase64(text: string): string | null {
  const cleaned = text.trim().replace(/\s+/g, '');
  if (cleaned.length < 12 || !/^[A-Za-z0-9+/=_-]+$/.test(cleaned)) {
    return null;
  }
  try {
    const standard = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
    const decoded = atob(padded);
    if (decoded.includes('://')) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

function parseSingleUriLine(line: string, index: number): ParsedEndpointSummary | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;

  const schemeMatch = trimmed.match(/^([a-zA-Z0-9+.-]+):\/\//);
  if (!schemeMatch) return null;

  const scheme = schemeMatch[1].toLowerCase();
  const mapped = SUPPORTED_URI_SCHEMES.get(scheme) ?? {
    protocol: scheme.toUpperCase(),
    supported: false,
  };

  if (scheme === 'vmess') {
    const rawJsonPart = trimmed.slice('vmess://'.length);
    try {
      const decoded = JSON.parse(atob(rawJsonPart)) as {
        ps?: string;
        add?: string;
        port?: number | string;
      };
      return {
        id: `node_${index}`,
        name: decoded.ps?.trim() || `VMess Node ${index + 1}`,
        protocol: 'VMess',
        supported: true,
        hostRedacted: redactHost(decoded.add ?? ''),
        probeHost: decoded.add?.trim() || undefined,
        port: decoded.port ? Number(decoded.port) || null : 443,
        countryHint: null,
      };
    } catch {
      return {
        id: `node_${index}`,
        name: `VMess Node ${index + 1}`,
        protocol: 'VMess',
        supported: false,
        hostRedacted: '***',
        port: null,
        countryHint: null,
      };
    }
  }

  try {
    const asUrl = new URL(trimmed);
    const fragmentName = decodeURIComponent(asUrl.hash.replace(/^#/, '')).trim();
    const fallbackPort =
      scheme === 'http' ? 80 : scheme === 'socks' || scheme === 'socks5' ? 1080 : 443;
    return {
      id: `node_${index}`,
      name: fragmentName || `${mapped.protocol} Node ${index + 1}`,
      protocol: mapped.protocol,
      supported: mapped.supported,
      hostRedacted: redactHost(asUrl.hostname),
      probeHost: asUrl.hostname.replace(/^\[|\]$/g, '') || undefined,
      port: asUrl.port ? Number(asUrl.port) || fallbackPort : fallbackPort,
      countryHint: null,
    };
  } catch {
    return {
      id: `node_${index}`,
      name: `${mapped.protocol} Node ${index + 1}`,
      protocol: mapped.protocol,
      supported: false,
      hostRedacted: '***',
      port: null,
      countryHint: null,
    };
  }
}

export function parseSubscriptionPayload(rawContent: string): {
  endpoints: ParsedEndpointSummary[];
  formatDetected: 'uri_list' | 'base64_uri_list' | 'sing_box_json' | 'wireguard_conf' | 'unknown';
} {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return { endpoints: [], formatDetected: 'unknown' };
  }

  // 1. Try sing-box JSON config
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        outbounds?: Array<{
          tag?: string;
          type?: string;
          server?: string;
          server_port?: number;
        }>;
      };
      if (Array.isArray(parsed.outbounds)) {
        const endpoints: ParsedEndpointSummary[] = parsed.outbounds
          .filter((o) => o.type && !['direct', 'block', 'dns', 'selector', 'urltest'].includes(o.type))
          .map((o, idx) => {
            const typeKey = (o.type ?? '').toLowerCase();
            const known = SUPPORTED_URI_SCHEMES.get(typeKey);
            return {
              id: `sb_${idx}`,
              name: o.tag?.trim() || `${typeKey.toUpperCase()} Node ${idx + 1}`,
              protocol: known?.protocol ?? typeKey.toUpperCase(),
              supported: known?.supported ?? false,
              hostRedacted: redactHost(o.server ?? ''),
              probeHost: o.server?.trim() || undefined,
              port: typeof o.server_port === 'number' ? o.server_port : 443,
              countryHint: null,
            };
          });
        return { endpoints, formatDetected: 'sing_box_json' };
      }
    } catch {
      // Fall through
    }
  }

  // 2. Try WireGuard INI config
  if (trimmed.includes('[Interface]') && trimmed.includes('[Peer]')) {
    const endpointLine = trimmed
      .split(/\r?\n/)
      .find((l) => l.trim().toLowerCase().startsWith('endpoint'));
    let hostRedacted = '***';
    let probeHost: string | undefined;
    let port: number | null = null;
    if (endpointLine) {
      const val = endpointLine.split('=')[1]?.trim() ?? '';
      const lastColon = val.lastIndexOf(':');
      if (lastColon > 0) {
        const rawHost = val.slice(0, lastColon).trim();
        hostRedacted = redactHost(rawHost);
        probeHost = rawHost || undefined;
        port = Number(val.slice(lastColon + 1)) || null;
      }
    }
    return {
      endpoints: [
        {
          id: 'wg_0',
          name: 'WireGuard Tunnel',
          protocol: 'WireGuard',
          supported: true,
          hostRedacted,
          probeHost,
          port,
          countryHint: null,
        },
      ],
      formatDetected: 'wireguard_conf',
    };
  }

  // 3. Try Base64 encoded URI list
  const decoded = !trimmed.includes('://') ? tryDecodeBase64(trimmed) : null;
  const effectiveText = decoded ?? trimmed;
  const lines = effectiveText.split(/\r?\n/);
  const endpoints: ParsedEndpointSummary[] = [];

  lines.forEach((line, idx) => {
    const parsed = parseSingleUriLine(line, idx);
    if (parsed) endpoints.push(parsed);
  });

  if (endpoints.length > 0) {
    return {
      endpoints,
      formatDetected: decoded ? 'base64_uri_list' : 'uri_list',
    };
  }

  return { endpoints: [], formatDetected: 'unknown' };
}

export function parseSubscriptionUserInfoHeader(headerValue: string): {
  usedBytes: number | null;
  totalBytes: number | null;
  expiresAt: string | null;
  type: SubscriptionType;
} {
  const pairs = new Map<string, number>();
  for (const part of headerValue.split(';')) {
    const [rawKey, rawVal] = part.split('=');
    if (!rawKey || !rawVal) continue;
    const num = Number(rawVal.trim());
    if (Number.isFinite(num) && num >= 0) {
      pairs.set(rawKey.trim().toLowerCase(), num);
    }
  }

  const upload = pairs.get('upload') ?? 0;
  const download = pairs.get('download') ?? 0;
  const hasTraffic = pairs.has('upload') || pairs.has('download');
  const total = pairs.get('total');
  const expireSec = pairs.get('expire');

  const totalBytes = total !== undefined && total > 0 ? total : null;
  const expiresAt =
    expireSec !== undefined && expireSec > 0 ? new Date(expireSec * 1000).toISOString() : null;

  let type: SubscriptionType = 'custom';
  if (totalBytes && expiresAt) type = 'combined';
  else if (totalBytes) type = 'traffic';
  else if (expiresAt) type = 'time';
  else if (total === 0 && expireSec === 0) type = 'unlimited';

  return {
    usedBytes: hasTraffic ? upload + download : null,
    totalBytes,
    expiresAt,
    type,
  };
}

export function formatBytesCompact(bytes: number | null, unavailableLabel: string): string {
  if (bytes === null || !Number.isFinite(bytes)) return unavailableLabel;
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / 1024 ** idx;
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}
