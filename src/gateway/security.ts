import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';
import { GatewayError } from './errors.ts';

// Ephemeral process-local fallback if ASIS_JWT_SECRET is not provided in environment.
const SIGNING_SECRET =
  process.env.ASIS_JWT_SECRET && process.env.ASIS_JWT_SECRET.length >= 16
    ? process.env.ASIS_JWT_SECRET
    : crypto.randomBytes(32).toString('hex');

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

  if (claims.tokenType !== 'access' || !claims.sub || !claims.deviceId) {
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

function isPrivateOrLoopbackIPv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  );
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
