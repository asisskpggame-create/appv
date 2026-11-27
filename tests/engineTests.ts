import assert from 'node:assert/strict';
import test from 'node:test';
import { installNativeBridge } from '../src/engine/nativeBridge.ts';
import { validateAndParseOutbound } from '../src/engine/protocolValidator.ts';
import { buildSingBoxConfig, ConfigBuildError } from '../src/engine/singBoxConfig.ts';
import { clearEndpointLinks, getEndpointLink, registerEndpointLinks } from '../src/engine/endpointLinks.ts';
import { extractEndpointLinks, parseSubscriptionPayload } from '../src/features/subscriptions/subscriptionParser.ts';
import type { AdvancedConnectionPolicy } from '../src/engine/types.ts';

const POLICY: AdvancedConnectionPolicy = {
  killSwitch: false,
  splitTunnelingMode: 'bypass_lan',
  splitTunnelingRuleMode: 'exclude_selected',
  splitTunnelingAppIds: [],
  customDns: '1.1.1.1',
  ipv6Mode: 'auto',
  mtu: 1400,
  autoReconnect: true,
  connectionTimeoutSec: 15,
  protocolPreference: 'auto',
  routingMode: 'rule',
  allowLocalNetwork: true,
  localSocksPort: 10808,
  localHttpPort: 10809,
};

const UUID = '11111111-1111-1111-1111-111111111111';

test('VLESS+Reality link keeps key, short id, flow, fingerprint and transport', () => {
  const r = validateAndParseOutbound(
    `vless://${UUID}@vpn.example.com:443?security=reality&type=grpc&serviceName=svc&sni=cdn.example.com&pbk=PUBKEY&sid=ab12&fp=chrome&flow=xtls-rprx-vision#DE`,
    'android',
  );
  assert.equal(r.valid, true);
  const o = r.outbound!.singBoxOutbound as Record<string, any>;
  assert.equal(o.uuid, UUID);
  assert.equal(o.flow, 'xtls-rprx-vision');
  assert.equal(o.tls.server_name, 'cdn.example.com');
  assert.equal(o.tls.reality.public_key, 'PUBKEY');
  assert.equal(o.tls.reality.short_id, 'ab12');
  assert.equal(o.tls.utls.fingerprint, 'chrome');
  assert.deepEqual(o.transport, { type: 'grpc', service_name: 'svc' });
});

test('VLESS+WS+TLS link builds ws transport with Host header', () => {
  const r = validateAndParseOutbound(
    `vless://${UUID}@vpn.example.com:443?security=tls&type=ws&path=%2Fws&host=front.example.com#x`,
    'android',
  );
  const o = r.outbound!.singBoxOutbound as Record<string, any>;
  assert.deepEqual(o.transport, { type: 'ws', path: '/ws', headers: { Host: 'front.example.com' } });
  assert.equal(o.tls.enabled, true);
});

test('Trojan, Shadowsocks (SIP002 base64), Hysteria2 and TUIC carry their credentials', () => {
  const trojan = validateAndParseOutbound('trojan://s3cret@t.example.com:443?sni=a.example.com#t', 'android');
  assert.equal((trojan.outbound!.singBoxOutbound as any).password, 's3cret');
  assert.equal((trojan.outbound!.singBoxOutbound as any).tls.server_name, 'a.example.com');

  const b64 = Buffer.from('aes-256-gcm:pa55').toString('base64').replace(/=+$/, '');
  const ss = validateAndParseOutbound(`ss://${b64}@s.example.com:8388#s`, 'android');
  assert.equal(ss.valid, true);
  assert.equal((ss.outbound!.singBoxOutbound as any).method, 'aes-256-gcm');
  assert.equal((ss.outbound!.singBoxOutbound as any).password, 'pa55');

  const hy = validateAndParseOutbound('hy2://authpw@h.example.com:443?sni=h.example.com&obfs=salamander&obfs-password=op#h', 'android');
  const ho = hy.outbound!.singBoxOutbound as any;
  assert.equal(ho.type, 'hysteria2');
  assert.equal(ho.password, 'authpw');
  assert.deepEqual(ho.obfs, { type: 'salamander', password: 'op' });

  const tuic = validateAndParseOutbound(`tuic://${UUID}:pw@u.example.com:443?congestion_control=bbr#u`, 'android');
  assert.equal((tuic.outbound!.singBoxOutbound as any).password, 'pw');
});

test('WireGuard links are rejected instead of producing a half-config; credential-less links are invalid', () => {
  assert.equal(validateAndParseOutbound('wg://host.example.com:51820', 'android').valid, false);
  assert.equal(validateAndParseOutbound('hy2://h.example.com:443', 'android').valid, false);
  assert.equal(validateAndParseOutbound('ss://h.example.com:8388', 'android').valid, false);
});

test('extractEndpointLinks maps node ids to full links and registry stays in memory', () => {
  const raw = [`vless://${UUID}@a.example.com:443?security=tls#A`, '# comment', 'trojan://pw@b.example.com:443#B'].join('\n');
  const ids = parseSubscriptionPayload(raw).endpoints.map((e) => e.id);
  const links = extractEndpointLinks(raw);
  assert.deepEqual(Object.keys(links), ids);
  assert.ok(links[ids[1]].startsWith('trojan://pw@'));

  registerEndpointLinks('sub1', links);
  assert.equal(getEndpointLink(`sub1:${ids[0]}`), links[ids[0]]);
  registerEndpointLinks('sub1', { node_9: 'trojan://x@y:1' });
  assert.equal(getEndpointLink(`sub1:${ids[0]}`), null, 're-register replaces old links');
  clearEndpointLinks();
  assert.equal(getEndpointLink('sub1:node_9'), null);
});

test('buildSingBoxConfig: tun inbound, proxy outbound, dns hijack, private bypass', () => {
  const out = { type: 'vless', server: 'vpn.example.com', server_port: 443, uuid: UUID };
  const { config } = buildSingBoxConfig(out, POLICY);
  const c = config as Record<string, any>;
  assert.equal(c.inbounds[0].type, 'tun');
  assert.equal(c.inbounds[0].mtu, 1400);
  assert.equal(c.outbounds[0].tag, 'proxy');
  assert.equal(c.outbounds[0].uuid, UUID);
  assert.equal(c.route.final, 'proxy');
  assert.deepEqual(c.route.rules[0], { action: 'sniff' });
  assert.ok(c.route.rules.some((r: any) => r.action === 'hijack-dns'));
  assert.ok(c.route.rules.some((r: any) => r.ip_is_private === true && r.outbound === 'direct'));
  assert.deepEqual(c.dns.rules[0], { domain: ['vpn.example.com'], server: 'dns-direct' });
  assert.equal(c.dns.servers[0].detour, 'proxy');
  assert.equal(JSON.stringify(c).includes('clash_api'), false);
});

test('buildSingBoxConfig: ipv6 disable, custom split tunneling, bad inputs', () => {
  const out = { type: 'trojan', server: 't.example.com', server_port: 443, password: 'p' };

  const v4 = buildSingBoxConfig(out, { ...POLICY, ipv6Mode: 'disable' }).config as any;
  assert.deepEqual(v4.inbounds[0].address, ['172.19.0.1/30']);
  assert.equal(v4.dns.strategy, 'ipv4_only');
  assert.ok(v4.route.rules.some((r: any) => r.ip_version === 6 && r.action === 'reject'));

  const excl = buildSingBoxConfig(out, {
    ...POLICY,
    splitTunnelingMode: 'custom',
    splitTunnelingAppIds: ['com.android.chrome', 'chrome-bin'],
  });
  assert.deepEqual((excl.config as any).inbounds[0].exclude_package, ['com.android.chrome']);
  assert.equal(excl.warnings.length, 1);

  const incl = buildSingBoxConfig(out, {
    ...POLICY,
    splitTunnelingMode: 'custom',
    splitTunnelingRuleMode: 'include_selected',
    splitTunnelingAppIds: ['org.telegram.messenger'],
  });
  assert.deepEqual((incl.config as any).inbounds[0].include_package, ['org.telegram.messenger']);

  assert.throws(
    () => buildSingBoxConfig(out, { ...POLICY, splitTunnelingMode: 'custom', splitTunnelingRuleMode: 'include_selected' }),
    (e: unknown) => e instanceof ConfigBuildError && e.code === 'ENGINE_POLICY_INVALID',
  );
  assert.throws(
    () => buildSingBoxConfig(out, { ...POLICY, splitTunnelingMode: 'bypass_iran' }),
    (e: unknown) => e instanceof ConfigBuildError && e.code === 'ENGINE_POLICY_UNSUPPORTED',
  );
  assert.throws(() => buildSingBoxConfig({ type: 'vless' }, POLICY), ConfigBuildError);

  const dnsFallback = buildSingBoxConfig(out, { ...POLICY, customDns: 'x; rm -rf' });
  assert.equal((dnsFallback.config as any).dns.servers[0].address, '1.1.1.1');
  assert.equal(dnsFallback.warnings.length, 1);
});

test('installNativeBridge: no-op in browser, wires plugin calls on Android', async () => {
  assert.equal(installNativeBridge({} as any), false);
  assert.equal(
    installNativeBridge({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } } as any),
    false,
  );

  const calls: any[] = [];
  const plugin = {
    connect: async (o: any) => void calls.push(['connect', o]),
    disconnect: async () => void calls.push(['disconnect']),
    getState: async () => ({ state: 'Connected' }),
    getStats: async () => ({ sessionDurationSec: 42 }),
    getInstalledApplications: async () => ({ apps: [{ id: 'com.a', name: 'A', identifier: 'com.a', category: 'other', source: 'native_bridge' }] }),
  };
  const win: any = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { AsisVpn: plugin } },
  };
  assert.equal(installNativeBridge(win), true);
  assert.equal(win.AsisNativeBridge.platform, 'android');

  await win.AsisNativeBridge.connect(
    JSON.stringify({ type: 'trojan', server: 't.example.com', server_port: 443, password: 'p' }),
    JSON.stringify({ ...POLICY, connectionTimeoutSec: 20 }),
  );
  assert.equal(calls[0][0], 'connect');
  assert.equal(calls[0][1].timeoutSec, 20);
  assert.equal(JSON.parse(calls[0][1].config).inbounds[0].type, 'tun');

  assert.equal(await win.AsisNativeBridge.getState(), 'Connected');
  assert.equal((await win.AsisNativeBridge.getStats()).sessionDurationSec, 42);
  assert.equal((await win.AsisNativeBridge.getInstalledApplications())[0].id, 'com.a');
  await assert.rejects(() => win.AsisNativeBridge.connect('not json', '{}'), /not valid JSON/);
});

test('buildSingBoxConfig: several servers become a urltest group, one server stays a plain proxy', () => {
  const a = { type: 'trojan', server: 'a.example.com', server_port: 443, password: 'p' };
  const b = { type: 'trojan', server: 'b.example.com', server_port: 443, password: 'q' };

  const single = buildSingBoxConfig(a, POLICY);
  assert.equal(single.mode, 'single');
  assert.deepEqual(single.tags, ['proxy']);
  assert.equal((single.config.outbounds as any[])[0].tag, 'proxy');
  assert.equal((single.config as any).experimental, undefined);

  const auto = buildSingBoxConfig([a, b], POLICY, { controller: { port: 23456, secret: 'ab'.repeat(16) } });
  assert.equal(auto.mode, 'auto');
  assert.deepEqual(auto.tags, ['node-0', 'node-1']);
  const outs = auto.config.outbounds as any[];
  assert.equal(outs[0].tag, 'node-0');
  assert.equal(outs[1].server, 'b.example.com');
  const group = outs.find((o) => o.type === 'urltest');
  assert.equal(group.tag, 'proxy');
  assert.deepEqual(group.outbounds, ['node-0', 'node-1']);
  assert.match(group.url, /^https:\/\//);
  assert.equal((auto.config.route as any).final, 'proxy');
  assert.deepEqual((auto.config.dns as any).rules[0].domain, ['a.example.com', 'b.example.com']);
  assert.equal((auto.config as any).experimental.clash_api.external_controller, '127.0.0.1:23456');

  assert.throws(
    () => buildSingBoxConfig([a, b], POLICY, { controller: { port: 80, secret: 'x' } }),
    (e: unknown) => e instanceof ConfigBuildError && e.code === 'ENGINE_INVALID_INPUT',
  );
  const many = Array.from({ length: 20 }, (_, i) => ({ ...a, server: `s${i}.example.com` }));
  const capped = buildSingBoxConfig(many, POLICY);
  assert.equal(capped.tags.length, 16);
  assert.equal(capped.warnings.length >= 1, true);
});

test('native bridge: array connect builds an auto group with a loopback controller; tunnel status passes through', async () => {
  const calls: any[] = [];
  const status = { available: true, active: 'node-1', delays: { 'node-0': 180, 'node-1': 95 } };
  const plugin = {
    connect: async (o: any) => void calls.push(o),
    disconnect: async () => {},
    getState: async () => ({ state: 'Connected' }),
    getStats: async () => ({ sessionDurationSec: 1 }),
    getInstalledApplications: async () => ({ apps: [] }),
    tcpProbe: async () => ({ results: [] }),
    getTunnelStatus: async () => status,
    runTunnelTest: async () => status,
  };
  const win: any = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { AsisVpn: plugin } },
  };
  assert.equal(installNativeBridge(win), true);
  const a = { type: 'trojan', server: 'a.example.com', server_port: 443, password: 'p' };
  const b = { type: 'trojan', server: 'b.example.com', server_port: 443, password: 'q' };
  await win.AsisNativeBridge.connect(JSON.stringify([a, b]), JSON.stringify(POLICY));
  const cfg = JSON.parse(calls[0].config);
  assert.equal(cfg.outbounds.find((o: any) => o.type === 'urltest').outbounds.length, 2);
  const api = cfg.experimental.clash_api;
  assert.match(api.external_controller, /^127\.0\.0\.1:\d{5}$/);
  assert.match(api.secret, /^[0-9a-f]{32,}$/);

  await win.AsisNativeBridge.connect(JSON.stringify(a), JSON.stringify(POLICY));
  assert.equal(JSON.parse(calls[1].config).outbounds[0].tag, 'proxy');

  assert.deepEqual(await win.AsisNativeBridge.getTunnelStatus(), status);
  assert.deepEqual(await win.AsisNativeBridge.runTunnelTest(), status);
  await assert.rejects(() => win.AsisNativeBridge.connect('[1,2]', '{}'), /not valid JSON/);
});

import { decideAutoConnect, type AutoConnectInput } from '../src/features/home/autoConnect.ts';

const readyAuto: AutoConnectInput = {
  enabled: true,
  pending: true,
  connState: 'Disconnected',
  hasConsent: true,
  nativeAvailable: true,
  serverResolved: true,
  hasLink: true,
};

test('auto-connect: connects only when every condition holds', () => {
  assert.equal(decideAutoConnect(readyAuto), 'connect');
  assert.equal(decideAutoConnect({ ...readyAuto, enabled: false }), 'skip');
  assert.equal(decideAutoConnect({ ...readyAuto, pending: false }), 'skip');
  assert.equal(decideAutoConnect({ ...readyAuto, hasConsent: false }), 'skip');
  assert.equal(decideAutoConnect({ ...readyAuto, nativeAvailable: false }), 'skip');
  assert.equal(decideAutoConnect({ ...readyAuto, connState: 'Connected' }), 'skip');
  assert.equal(decideAutoConnect({ ...readyAuto, connState: 'Connecting' }), 'skip');
});

test('auto-connect: waits for the server list, gives up without a full link', () => {
  assert.equal(decideAutoConnect({ ...readyAuto, serverResolved: false, hasLink: false }), 'wait');
  assert.equal(decideAutoConnect({ ...readyAuto, hasLink: false }), 'skip');
});
