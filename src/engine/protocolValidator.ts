import type {
  EngineProtocol,
  EngineValidationResult,
  ProtocolSupportEntry,
  SanitizedOutboundConfig,
  TargetPlatform,
} from './types.ts';

export const PROTOCOL_SUPPORT_MATRIX: ProtocolSupportEntry[] = [
  {
    protocol: 'VLESS + Reality',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box core on native platforms.',
  },
  {
    protocol: 'VLESS + TLS',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box core on native platforms.',
  },
  {
    protocol: 'VLESS',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box core on native platforms.',
  },
  {
    protocol: 'VMess',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box core on native platforms.',
  },
  {
    protocol: 'Trojan',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box core on native platforms.',
  },
  {
    protocol: 'Shadowsocks',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box core on native platforms.',
  },
  {
    protocol: 'WireGuard',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'Verified via sing-box WireGuard outbound or native kernel adapter.',
  },
  {
    protocol: 'Hysteria2',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'QUIC-based outbound via sing-box.',
  },
  {
    protocol: 'TUIC',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'QUIC-based v5 outbound via sing-box.',
  },
  {
    protocol: 'SOCKS',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'SOCKS5 outbound via sing-box.',
  },
  {
    protocol: 'HTTP Proxy',
    engine: 'sing-box',
    supportedPlatforms: ['android', 'ios', 'windows'],
    webRuntimeSupported: false,
    notes: 'HTTP CONNECT outbound via sing-box.',
  },
  {
    protocol: 'OpenVPN',
    engine: 'unsupported',
    supportedPlatforms: [],
    webRuntimeSupported: false,
    notes: 'UNSUPPORTED: Requires dedicated OpenVPN3 native C++ adapter (not bundled in sing-box).',
  },
  {
    protocol: 'IKEv2',
    engine: 'unsupported',
    supportedPlatforms: [],
    webRuntimeSupported: false,
    notes: 'UNSUPPORTED: Requires OS-specific NEVPNManager / Windows RAS implementation.',
  },
];

function redactHost(host: string): string {
  if (!host || host.length <= 6) return '***';
  return `${host.slice(0, 3)}***${host.slice(-3)}`;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isProtocolSupportedOnPlatform(protocol: EngineProtocol, platform: TargetPlatform): boolean {
  const entry = PROTOCOL_SUPPORT_MATRIX.find((p) => p.protocol === protocol);
  if (!entry) return false;
  if (platform === 'web') return entry.webRuntimeSupported;
  return entry.supportedPlatforms.includes(platform);
}

/**
 * Validates and converts a single URI or sing-box JSON outbound into a strict, injection-safe outbound AST.
 */
export function validateAndParseOutbound(
  rawInput: string,
  targetPlatform: TargetPlatform = 'web',
): EngineValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      protocol: 'UNKNOWN',
      supportedOnCurrentPlatform: false,
      errors: ['Configuration input is empty.'],
    };
  }

  // Block dangerous sing-box top-level config injection fields if JSON is supplied
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if ('experimental' in parsed || 'clash_api' in parsed) {
        return {
          valid: false,
          protocol: 'UNKNOWN',
          supportedOnCurrentPlatform: false,
          errors: ['Rejected configuration: disallowed experimental or clash_api injection keys.'],
        };
      }
      const type = String(parsed.type ?? '').toLowerCase();
      const server = String(parsed.server ?? '').trim();
      const port = Number(parsed.server_port);
      if (!type || !server || !isValidPort(port)) {
        return {
          valid: false,
          protocol: 'UNKNOWN',
          supportedOnCurrentPlatform: false,
          errors: ['Invalid JSON outbound: missing type, server, or valid server_port.'],
        };
      }
      const protocolMap: Record<string, EngineProtocol> = {
        vless: 'VLESS',
        vmess: 'VMess',
        trojan: 'Trojan',
        shadowsocks: 'Shadowsocks',
        wireguard: 'WireGuard',
        hysteria2: 'Hysteria2',
        tuic: 'TUIC',
        socks: 'SOCKS',
        http: 'HTTP Proxy',
      };
      const protocol = protocolMap[type];
      if (!protocol) {
        return {
          valid: false,
          protocol: 'UNKNOWN',
          supportedOnCurrentPlatform: false,
          errors: [`Unsupported JSON outbound type: ${type}`],
        };
      }
      const outbound: SanitizedOutboundConfig = {
        id: `out_${type}_${port}`,
        tag: String(parsed.tag ?? `${protocol} Outbound`).slice(0, 64),
        protocol,
        serverRedacted: redactHost(server),
        port,
        transport: 'tcp',
        tlsSecurity: 'none',
        singBoxOutbound: {
          type,
          tag: 'proxy',
          server,
          server_port: port,
        },
      };
      return {
        valid: true,
        protocol,
        supportedOnCurrentPlatform: isProtocolSupportedOnPlatform(protocol, targetPlatform),
        errors: [],
        outbound,
      };
    } catch {
      return {
        valid: false,
        protocol: 'UNKNOWN',
        supportedOnCurrentPlatform: false,
        errors: ['Malformed JSON configuration payload.'],
      };
    }
  }

  // URI validation
  const schemeMatch = trimmed.match(/^([a-zA-Z0-9+.-]+):\/\//);
  if (!schemeMatch) {
    return {
      valid: false,
      protocol: 'UNKNOWN',
      supportedOnCurrentPlatform: false,
      errors: ['Configuration must be a valid protocol URI or sing-box JSON outbound.'],
    };
  }

  const scheme = schemeMatch[1].toLowerCase();

  if (scheme === 'openvpn' || scheme === 'ikev2') {
    const proto: EngineProtocol = scheme === 'openvpn' ? 'OpenVPN' : 'IKEv2';
    return {
      valid: false,
      protocol: proto,
      supportedOnCurrentPlatform: false,
      errors: [`Protocol ${proto} is currently UNSUPPORTED by the bundled sing-box engine.`],
    };
  }

  if (scheme === 'vmess') {
    try {
      const decoded = JSON.parse(atob(trimmed.slice('vmess://'.length))) as {
        ps?: string;
        add?: string;
        port?: number | string;
        id?: string;
        net?: string;
        tls?: string;
      };
      const port = Number(decoded.port);
      if (!decoded.add || !decoded.id || !isValidPort(port)) {
        return {
          valid: false,
          protocol: 'VMess',
          supportedOnCurrentPlatform: false,
          errors: ['Invalid VMess payload: missing server address, UUID, or valid port.'],
        };
      }
      const outbound: SanitizedOutboundConfig = {
        id: `vmess_${port}`,
        tag: decoded.ps?.trim() || 'VMess Outbound',
        protocol: 'VMess',
        serverRedacted: redactHost(decoded.add),
        port,
        transport: decoded.net || 'tcp',
        tlsSecurity: decoded.tls === 'tls' ? 'tls' : 'none',
        singBoxOutbound: {
          type: 'vmess',
          tag: 'proxy',
          server: decoded.add,
          server_port: port,
          uuid: decoded.id,
          security: 'auto',
        },
      };
      return {
        valid: true,
        protocol: 'VMess',
        supportedOnCurrentPlatform: isProtocolSupportedOnPlatform('VMess', targetPlatform),
        errors: [],
        outbound,
      };
    } catch {
      return {
        valid: false,
        protocol: 'VMess',
        supportedOnCurrentPlatform: false,
        errors: ['Malformed Base64 VMess URI.'],
      };
    }
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      valid: false,
      protocol: 'UNKNOWN',
      supportedOnCurrentPlatform: false,
      errors: ['Malformed URI syntax.'],
    };
  }

  const host = url.hostname.trim();
  const port = Number(url.port || (scheme === 'http' ? '80' : '443'));
  if (!host || !isValidPort(port)) {
    return {
      valid: false,
      protocol: 'UNKNOWN',
      supportedOnCurrentPlatform: false,
      errors: ['Missing valid server hostname or port (1–65535).'],
    };
  }

  const tag = decodeURIComponent(url.hash.replace(/^#/, '')).trim() || `${scheme.toUpperCase()} Node`;
  const security = (url.searchParams.get('security') || '').toLowerCase();
  const transport = (url.searchParams.get('type') || 'tcp').toLowerCase();

  if (scheme === 'vless') {
    if (!url.username) {
      return {
        valid: false,
        protocol: 'VLESS',
        supportedOnCurrentPlatform: false,
        errors: ['VLESS URI is missing user UUID.'],
      };
    }
    const proto: EngineProtocol =
      security === 'reality' ? 'VLESS + Reality' : security === 'tls' ? 'VLESS + TLS' : 'VLESS';
    const outbound: SanitizedOutboundConfig = {
      id: `vless_${port}`,
      tag,
      protocol: proto,
      serverRedacted: redactHost(host),
      port,
      transport,
      tlsSecurity: security === 'reality' ? 'reality' : security === 'tls' ? 'tls' : 'none',
      singBoxOutbound: {
        type: 'vless',
        tag: 'proxy',
        server: host,
        server_port: port,
        uuid: url.username,
        ...(security === 'tls' || security === 'reality'
          ? {
              tls: {
                enabled: true,
                server_name: url.searchParams.get('sni') || host,
              },
            }
          : {}),
      },
    };
    return {
      valid: true,
      protocol: proto,
      supportedOnCurrentPlatform: isProtocolSupportedOnPlatform(proto, targetPlatform),
      errors: [],
      outbound,
    };
  }

  if (scheme === 'trojan') {
    if (!url.username) {
      return {
        valid: false,
        protocol: 'Trojan',
        supportedOnCurrentPlatform: false,
        errors: ['Trojan URI is missing credential password.'],
      };
    }
    const outbound: SanitizedOutboundConfig = {
      id: `trojan_${port}`,
      tag,
      protocol: 'Trojan',
      serverRedacted: redactHost(host),
      port,
      transport,
      tlsSecurity: 'tls',
      singBoxOutbound: {
        type: 'trojan',
        tag: 'proxy',
        server: host,
        server_port: port,
        password: url.username,
        tls: { enabled: true, server_name: url.searchParams.get('sni') || host },
      },
    };
    return {
      valid: true,
      protocol: 'Trojan',
      supportedOnCurrentPlatform: isProtocolSupportedOnPlatform('Trojan', targetPlatform),
      errors: [],
      outbound,
    };
  }

  const genericSchemeMap: Record<string, EngineProtocol> = {
    ss: 'Shadowsocks',
    hysteria2: 'Hysteria2',
    hy2: 'Hysteria2',
    tuic: 'TUIC',
    wg: 'WireGuard',
    wireguard: 'WireGuard',
    socks: 'SOCKS',
    socks5: 'SOCKS',
    http: 'HTTP Proxy',
  };

  const mappedProtocol = genericSchemeMap[scheme];
  if (!mappedProtocol) {
    return {
      valid: false,
      protocol: 'UNKNOWN',
      supportedOnCurrentPlatform: false,
      errors: [`Unsupported protocol scheme: ${scheme}`],
    };
  }

  const outbound: SanitizedOutboundConfig = {
    id: `${scheme}_${port}`,
    tag,
    protocol: mappedProtocol,
    serverRedacted: redactHost(host),
    port,
    transport: scheme === 'hysteria2' || scheme === 'hy2' || scheme === 'tuic' ? 'quic' : 'tcp',
    tlsSecurity: scheme === 'hysteria2' || scheme === 'hy2' || scheme === 'tuic' ? 'tls' : 'none',
    singBoxOutbound: {
      type: scheme === 'hy2' ? 'hysteria2' : scheme === 'ss' ? 'shadowsocks' : scheme,
      tag: 'proxy',
      server: host,
      server_port: port,
    },
  };

  return {
    valid: true,
    protocol: mappedProtocol,
    supportedOnCurrentPlatform: isProtocolSupportedOnPlatform(mappedProtocol, targetPlatform),
    errors: [],
    outbound,
  };
}
