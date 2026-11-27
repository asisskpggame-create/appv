import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';
import { GatewayError } from './errors.ts';

// ASIS_JWT_SECRET is mandatory in production (>= 32 chars). Outside production an ephemeral
// process-local secret is used, which invalidates all tokens on every restart.
function resolveSigningSecret(): string {
  const configured = process.env.ASIS_JWT_SECRET?.trim() ?? '';
  if (configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ASIS_JWT_SECRET must be set to a random value of at least 32 characters in production.');
  }
  console.warn('[security] ASIS_JWT_SECRET missing or too short; using an ephemeral dev secret.');
  return crypto.randomBytes(32).toString('hex');
}

const SIGNING_SECRET = resolveSigningSecret();

export interface AccessTokenClaims {
  sub: string;
  username: string;
  deviceId: string;
  tokenType: 'access';
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signAccessToken(
  payload: Omit<AccessTokenClaims, 'tokenType' | 'iat' | 'exp'>,
  ttlSeconds = 900,
): { token: string; expiresAtMs: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ttlSeconds;
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims: AccessTokenClaims = {
    ...payload,
    tokenType: 'access',
    iat: nowSec,
    exp: expSec,
  };
  const body = base64UrlEncode(JSON.stringify(claims));
  const signature = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return {
    token: `${header}.${body}.${signature}`,
    expiresAtMs: expSec * 1000,
  };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new GatewayError(401, 'AUTH_INVALID_TOKEN', 'session_expired', 'Malformed access token.');
  }

  const [header, body, providedSig] = parts;

  try {
    const parsedHeader = JSON.parse(base64UrlDecode(header)) as { alg?: unknown };
    if (parsedHeader.alg !== 'HS256') {
      throw new Error('unsupported alg');
    }
  } catch {
    throw new GatewayError(401, 'AUTH_INVALID_TOKEN', 'session_expired', 'Unsupported token header.');
  }

  const expectedSig = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new GatewayError(401, 'AUTH_INVALID_SIGNATURE', 'session_expired', 'Invalid access token signature.');
  }

  let claims: AccessTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(body)) as AccessTokenClaims;
  } catch {
    throw new GatewayError(401, 'AUTH_INVALID_TOKEN', 'session_expired', 'Unable to decode token claims.');
  }

  if (
    !claims ||
    claims.tokenType !== 'access' ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.deviceId !== 'string' ||
    !claims.deviceId ||
    typeof claims.exp !== 'number'
  ) {
    throw new GatewayError(401, 'AUTH_INVALID_TOKEN', 'session_expired', 'Invalid token claim structure.');
  }

  if (Math.floor(Date.now() / 1000) >= claims.exp) {
    throw new GatewayError(401, 'AUTH_SESSION_EXPIRED', 'session_expired', 'Access token has expired.', 'refresh_token');
  }

  return claims;
}

export function hashOpaqueSecret(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const BLOCKED_IPV4_CIDRS: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local / cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

const BLOCKED_IPV6_CIDRS: Array<[string, number]> = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (can embed private IPv4)
  ['100::', 64], // discard-only
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (can embed private IPv4)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
];

const blockList = new net.BlockList();
for (const [addr, prefix] of BLOCKED_IPV4_CIDRS) blockList.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of BLOCKED_IPV6_CIDRS) blockList.addSubnet(addr, prefix, 'ipv6');

/** Extracts the IPv4 part of an IPv4-mapped IPv6 address (::ffff:a.b.c.d or ::ffff:xxxx:xxxx). */
function unmapIPv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = /^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (dotted) return dotted[1];
  const hex = /^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** Returns true when the IP is private, loopback, link-local, reserved, or otherwise non-public. */
export function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return blockList.check(ip, 'ipv4');
  if (version === 6) {
    const mapped = unmapIPv4(ip);
    if (mapped && net.isIP(mapped) === 4) return blockList.check(mapped, 'ipv4');
    return blockList.check(ip, 'ipv6');
  }
  return true; // not a valid IP: fail closed
}

function isPrivateOrLoopbackIPv4(ip: string): boolean {
  return isBlockedIp(ip);
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  return isBlockedIp(ip);
}

/**
 * Validates user-supplied subscription URLs against SSRF and unsafe schemes.
 */
export function validateSubscriptionImportUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new GatewayError(
      400,
      'SUBSCRIPTION_INVALID_URL',
      'invalid_configuration',
      'Subscription URL is malformed.',
      'verify_url',
    );
  }

  if (parsed.username || parsed.password) {
    throw new GatewayError(
      400,
      'SUBSCRIPTION_CREDENTIALS_IN_URL',
      'invalid_configuration',
      'Subscription URLs must not embed credentials.',
      'verify_url',
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new GatewayError(
      400,
      'SUBSCRIPTION_INSECURE_SCHEME',
      'invalid_configuration',
      'Subscription URLs must use https://.',
      'use_https',
    );
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new GatewayError(
      400,
      'SUBSCRIPTION_BLOCKED_HOST',
      'invalid_configuration',
      'Subscription host is not permitted.',
      'verify_url',
    );
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4 && isPrivateOrLoopbackIPv4(host)) {
    throw new GatewayError(
      400,
      'SUBSCRIPTION_BLOCKED_HOST',
      'invalid_configuration',
      'Private or loopback IP targets are blocked.',
      'verify_url',
    );
  }
  if (ipVersion === 6 && isPrivateOrLoopbackIPv6(host)) {
    throw new GatewayError(
      400,
      'SUBSCRIPTION_BLOCKED_HOST',
      'invalid_configuration',
      'Private or loopback IPv6 targets are blocked.',
      'verify_url',
    );
  }

  return parsed;
}

export async function assertSafeProbeTarget(
  rawHost: string,
  rawPort: unknown,
): Promise<{ host: string; port: number }> {
  const host = typeof rawHost === 'string' ? rawHost.trim().toLowerCase().replace(/^\[|\]$/g, '') : '';
  const port = typeof rawPort === 'number' ? Math.floor(rawPort) : Number.parseInt(String(rawPort ?? ''), 10);

  if (!host || host.length > 253 || /[\s/\\@?#]/.test(host)) {
    throw new GatewayError(400, 'PROBE_INVALID_HOST', 'validation_error', 'Invalid probe host.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new GatewayError(400, 'PROBE_INVALID_PORT', 'validation_error', 'Invalid probe port.');
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new GatewayError(400, 'PROBE_BLOCKED_HOST', 'invalid_configuration', 'Local hosts cannot be probed.');
  }

  const checkIp = (ip: string) => {
    const ver = net.isIP(ip);
    if (ver === 4 && isPrivateOrLoopbackIPv4(ip)) {
      throw new GatewayError(400, 'PROBE_BLOCKED_HOST', 'invalid_configuration', 'Private IPv4 targets are blocked.');
    }
    if (ver === 6 && isPrivateOrLoopbackIPv6(ip)) {
      throw new GatewayError(400, 'PROBE_BLOCKED_HOST', 'invalid_configuration', 'Private IPv6 targets are blocked.');
    }
    if (ver === 0) {
      throw new GatewayError(400, 'PROBE_INVALID_HOST', 'validation_error', 'Unresolvable host.');
    }
  };

  if (net.isIP(host) !== 0) {
    checkIp(host);
    return { host, port };
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await dns.lookup(host, { all: true });
  } catch {
    throw new GatewayError(400, 'PROBE_DNS_FAILED', 'dns_failure', 'DNS resolution failed for target host.');
  }

  if (!resolved || resolved.length === 0) {
    throw new GatewayError(400, 'PROBE_DNS_FAILED', 'dns_failure', 'No IP addresses resolved.');
  }
  for (const record of resolved) {
    checkIp(record.address);
  }

  return { host: resolved[0].address, port };
}

export async function measureTcpLatencyMs(
  host: string,
  port: number,
  timeoutMs = 2800,
): Promise<{ latencyMs: number | null; available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const socket = net.createConnection({ host, port });

    const finish = (result: { latencyMs: number | null; available: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      const elapsed = Math.max(1, Math.round(performance.now() - started));
      finish({ latencyMs: elapsed, available: true });
    });
    socket.once('timeout', () => {
      finish({ latencyMs: null, available: false, error: 'timeout' });
    });
    socket.once('error', () => {
      finish({ latencyMs: null, available: false, error: 'unreachable' });
    });
  });
}

/**
 * Lightweight sliding-window rate limiter keyed by client IP + bucket.
 */
export function createRateLimiter(bucket: string, maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  // Drop idle keys periodically so the map cannot grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, stamps] of hits) {
      if (stamps.every((ts) => now - ts >= windowMs)) hits.delete(key);
    }
  }, Math.max(windowMs, 30_000));
  sweeper.unref();

  return (req: Request, _res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${bucket}:${ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
      return next(
        new GatewayError(
          429,
          'RATE_LIMIT_EXCEEDED',
          'rate_limited',
          'Too many requests. Please wait before retrying.',
          'wait_and_retry',
        ),
      );
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
