import type { AdvancedConnectionPolicy } from './types.ts';

/**
 * Builds the full sing-box config the Android engine runs.
 * Targets sing-box 1.11.x (route actions `sniff` / `hijack-dns`, legacy DNS server format).
 */
export class ConfigBuildError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ConfigBuildError';
    this.code = code;
  }
}

const ANDROID_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const IP_LITERAL = /^[0-9a-fA-F:.]+$/;
const DNS_URL = /^(https|tls|quic):\/\/[A-Za-z0-9.\-:[\]/_]+$/;

export const DEFAULT_TEST_URL = 'https://www.gstatic.com/generate_204';
export const GROUP_TAG_PREFIX = 'node-';
export const MAX_GROUP_SIZE = 16;

export interface BuildOptions {
  /** Local controller used by the app (never exposed beyond 127.0.0.1) to read urltest results. */
  controller?: { port: number; secret: string };
  testUrl?: string;
}

export interface BuiltConfig {
  config: Record<string, unknown>;
  warnings: string[];
  mode: 'single' | 'auto';
  /** Outbound tag per input outbound, in input order. */
  tags: string[];
}

function normalizeDns(raw: string, warnings: string[]): string {
  const value = raw.trim();
  if (value && (IP_LITERAL.test(value) || DNS_URL.test(value))) return value;
  warnings.push(`Custom DNS "${value}" is not valid; using 1.1.1.1.`);
  return '1.1.1.1';
}

export function buildSingBoxConfig(
  outboundInput: Record<string, unknown> | Array<Record<string, unknown>>,
  policy: AdvancedConnectionPolicy,
  options: BuildOptions = {},
): BuiltConfig {
  const warnings: string[] = [];

  let list = Array.isArray(outboundInput) ? outboundInput : [outboundInput];
  if (list.length === 0) {
    throw new ConfigBuildError('ENGINE_INVALID_OUTBOUND', 'No server was given.');
  }
  if (list.length > MAX_GROUP_SIZE) {
    warnings.push(`Only the first ${MAX_GROUP_SIZE} servers are used for auto-switch.`);
    list = list.slice(0, MAX_GROUP_SIZE);
  }
  for (const o of list) {
    if (!o || typeof o.type !== 'string' || typeof o.server !== 'string' || !o.server) {
      throw new ConfigBuildError('ENGINE_INVALID_OUTBOUND', 'The server entry has no usable type or address.');
    }
  }
  const auto = list.length > 1;
  const servers = Array.from(new Set(list.map((o) => o.server as string)));

  if (options.controller) {
    const { port, secret } = options.controller;
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[0-9a-f]{16,64}$/.test(secret)) {
      throw new ConfigBuildError('ENGINE_INVALID_INPUT', 'The local controller settings are invalid.');
    }
  }
  const testUrl = options.testUrl ?? DEFAULT_TEST_URL;
  if (!/^https?:\/\/[A-Za-z0-9.\-:/_?=&%]+$/.test(testUrl)) {
    throw new ConfigBuildError('ENGINE_INVALID_INPUT', 'The latency test URL is not valid.');
  }
  if (policy.splitTunnelingMode === 'bypass_iran') {
    throw new ConfigBuildError(
      'ENGINE_POLICY_UNSUPPORTED',
      '"Bypass domestic" needs a geo rule set that is not bundled yet. Pick another split-tunneling mode.',
    );
  }

  const ipv6Enabled = policy.ipv6Mode !== 'disable';
  const mtu = Number.isInteger(policy.mtu) && policy.mtu >= 1280 && policy.mtu <= 9000 ? policy.mtu : 1400;
  const dnsServer = normalizeDns(policy.customDns, warnings);

  const tun: Record<string, unknown> = {
    type: 'tun',
    tag: 'tun-in',
    address: ipv6Enabled ? ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'] : ['172.19.0.1/30'],
    mtu,
    auto_route: true,
    stack: 'mixed',
  };

  if (policy.splitTunnelingMode === 'custom') {
    const valid = policy.splitTunnelingAppIds.filter((id) => ANDROID_PACKAGE.test(id));
    const dropped = policy.splitTunnelingAppIds.length - valid.length;
    if (dropped > 0) warnings.push(`${dropped} entries in the app list are not Android package names and were ignored.`);
    if (policy.splitTunnelingRuleMode === 'include_selected') {
      if (valid.length === 0) {
        throw new ConfigBuildError(
          'ENGINE_POLICY_INVALID',
          'Split tunneling is set to "only selected apps" but no app is selected.',
        );
      }
      tun.include_package = valid;
    } else if (valid.length > 0) {
      tun.exclude_package = valid;
    }
  }

  const bypassPrivate = policy.allowLocalNetwork || policy.splitTunnelingMode === 'bypass_lan';
  const rules: Array<Record<string, unknown>> = [
    { action: 'sniff' },
    { protocol: 'dns', action: 'hijack-dns' },
  ];
  if (!ipv6Enabled) rules.push({ ip_version: 6, action: 'reject' });
  if (bypassPrivate) rules.push({ ip_is_private: true, outbound: 'direct' });

  const config = {
    log: { level: 'warn', timestamp: true },
    dns: {
      servers: [
        { tag: 'dns-remote', address: dnsServer, detour: 'proxy' },
        { tag: 'dns-direct', address: 'local' },
      ],
      rules: [{ domain: servers, server: 'dns-direct' }],
      final: 'dns-remote',
      strategy: ipv6Enabled ? (policy.ipv6Mode === 'prefer' ? 'prefer_ipv6' : 'prefer_ipv4') : 'ipv4_only',
    },
    inbounds: [tun],
    outbounds: auto
      ? [
          ...list.map((o, i) => ({ ...o, tag: `${GROUP_TAG_PREFIX}${i}` })),
          {
            type: 'urltest',
            tag: 'proxy',
            outbounds: list.map((_, i) => `${GROUP_TAG_PREFIX}${i}`),
            url: testUrl,
            interval: '2m',
            tolerance: 60,
            idle_timeout: '30m',
          },
          { type: 'direct', tag: 'direct' },
        ]
      : [{ ...list[0], tag: 'proxy' }, { type: 'direct', tag: 'direct' }],
    route: {
      rules,
      final: 'proxy',
      auto_detect_interface: true,
    },
    ...(options.controller
      ? {
          experimental: {
            clash_api: {
              external_controller: `127.0.0.1:${options.controller.port}`,
              secret: options.controller.secret,
            },
          },
        }
      : {}),
  };

  return {
    config,
    warnings,
    mode: auto ? 'auto' : 'single',
    tags: auto ? list.map((_, i) => `${GROUP_TAG_PREFIX}${i}`) : ['proxy'],
  };
}
