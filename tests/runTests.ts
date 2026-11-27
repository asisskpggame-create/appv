import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import express from 'express';
import { validateAndParseOutbound } from '../src/engine/protocolValidator.ts';
import { InMemoryGatewayStore } from '../src/gateway/adapters/gatewayStore.ts';
import { SqliteGatewayStore } from '../src/gateway/adapters/sqliteGatewayStore.ts';
import { authenticateWithLink, getLinkedContext, recordToSubscription } from '../src/gateway/linkedAccount.ts';
import { NotConnectedPasarGuardAdapter, PasarGuardAdapterRegistry } from '../src/gateway/adapters/pasarguardAdapter.ts';
import { NotConnectedResellerAdapter } from '../src/gateway/adapters/resellerAdapter.ts';
import { GatewayError } from '../src/gateway/errors.ts';
import { createGatewayRouter } from '../src/gateway/router.ts';
import {
  assertSafeProbeTarget,
  isBlockedIp,
  measureTcpLatencyMs,
  signAccessToken,
  validateSubscriptionImportUrl,
  verifyAccessToken,
} from '../src/gateway/security.ts';
import {
  buildServerCatalogFromSubscriptions,
  evaluateSmartSelection,
  getLatencyTier,
  inferCountryMetadata,
  parseTunnelTag,
} from '../src/features/servers/serverCatalogUtils.ts';
import { parseSubscriptionPayload } from '../src/features/subscriptions/subscriptionParser.ts';
import { validateCredentials } from '../src/features/auth/validation.ts';
import {
  computeQuotaBreakdown,
  normalizeAuthoritativeUsageResponse,
  normalizeUsageHistory,
} from '../src/features/statistics/trafficUtils.ts';
import {
  filterInstalledApps,
  isAppRoutedThroughVpn,
  setAllAppsVpnAccess,
  toggleAppVpnAccess,
  validateCustomAppRule,
} from '../src/features/settings/splitTunnelingUtils.ts';
import {
  applyThemeToDocument,
  normalizeThemePalette,
  normalizeThemePreference,
  resolveThemeCssVariables,
  type StyleTargetElement,
} from '../src/design-system/themeEngine.ts';

const AUTH_COPY = {
  validationUsernameRequired: 'Username is required.',
  validationUsernameMin: 'Username must be at least 3 characters.',
  validationUsernameFormat: 'Invalid username characters.',
  validationPasswordRequired: 'Password is required.',
  validationPasswordMin: 'Password must be at least 6 characters.',
};

test('Auth validation rejects empty/invalid credentials and accepts valid input', () => {
  const empty = validateCredentials({ username: '', password: '' }, AUTH_COPY);
  assert.equal(empty.username, AUTH_COPY.validationUsernameRequired);
  assert.equal(empty.password, AUTH_COPY.validationPasswordRequired);

  const short = validateCredentials({ username: 'ab', password: '123' }, AUTH_COPY);
  assert.equal(short.username, AUTH_COPY.validationUsernameMin);
  assert.equal(short.password, AUTH_COPY.validationPasswordMin);

  const badChars = validateCredentials({ username: 'user name!', password: 'secret12' }, AUTH_COPY);
  assert.equal(badChars.username, AUTH_COPY.validationUsernameFormat);
  assert.equal(badChars.password, undefined);

  const valid = validateCredentials({ username: 'asis_user.01', password: 'secret12' }, AUTH_COPY);
  assert.equal(valid.username, undefined);
  assert.equal(valid.password, undefined);
});

test('Protocol validator parses VLESS+Reality and rejects OpenVPN as unsupported', () => {
  const vless = validateAndParseOutbound(
    'vless://11111111-1111-1111-1111-111111111111@vpn.example.com:443?security=reality&type=grpc&sni=cdn.example.com#DE-Frankfurt',
    'android',
  );
  assert.equal(vless.valid, true);
  assert.equal(vless.protocol, 'VLESS + Reality');
  assert.equal(vless.supportedOnCurrentPlatform, true);
  assert.equal(vless.outbound?.port, 443);

  const openvpn = validateAndParseOutbound('openvpn://vpn.example.com:1194', 'android');
  assert.equal(openvpn.valid, false);
  assert.equal(openvpn.protocol, 'OpenVPN');
  assert.equal(openvpn.supportedOnCurrentPlatform, false);
});

test('Protocol validator blocks experimental/clash_api config injection', () => {
  const injected = validateAndParseOutbound(
    JSON.stringify({
      type: 'vless',
      server: 'vpn.example.com',
      server_port: 443,
      experimental: { clash_api: { external_controller: '0.0.0.0:9090' } },
    }),
    'windows',
  );
  assert.equal(injected.valid, false);
});

test('Subscription SSRF guard enforces https and blocks private/loopback targets', () => {
  const valid = validateSubscriptionImportUrl('https://sub.example.com/profile/abc');
  assert.equal(valid.hostname, 'sub.example.com');

  assert.throws(() => validateSubscriptionImportUrl('http://sub.example.com/sub'));
  assert.throws(() => validateSubscriptionImportUrl('https://127.0.0.1/sub'));
  assert.throws(() => validateSubscriptionImportUrl('https://169.254.169.254/latest/meta-data'));
  assert.throws(() => validateSubscriptionImportUrl('https://192.168.1.10/sub'));
  assert.throws(() => validateSubscriptionImportUrl('https://localhost/sub'));
});

test('Gateway JWT sign/verify and refresh token reuse detection work securely', () => {
  const { token } = signAccessToken({
    sub: 'usr_1',
    username: 'alice',
    deviceId: 'dev_1',
  });
  const claims = verifyAccessToken(token);
  assert.equal(claims.username, 'alice');

  const store = new InMemoryGatewayStore();
  const initial = store.issueRefreshSession('usr_1', 'alice', 'dev_1');
  const rotated = store.rotateRefreshToken(initial.refreshToken, 'dev_1');
  assert.ok(rotated);
  assert.notEqual(rotated.refreshToken, initial.refreshToken);

  // Replaying old refresh token must fail AND revoke the entire family
  const replay = store.rotateRefreshToken(initial.refreshToken, 'dev_1');
  assert.equal(replay, null);
  const afterReplay = store.rotateRefreshToken(rotated.refreshToken, 'dev_1');
  assert.equal(afterReplay, null);
});

test('Subscription Base64 parser & Smart Selection exclude unsupported protocols', () => {
  const rawList = [
    'openvpn://legacy.example.com:1194#Legacy-OVPN',
    'trojan://secretpass@de.example.com:443?sni=de.example.com#DE-Berlin',
  ].join('\n');
  const b64 = Buffer.from(rawList, 'utf8').toString('base64');
  const parsed = parseSubscriptionPayload(b64);
  assert.equal(parsed.formatDetected, 'base64_uri_list');
  assert.equal(parsed.endpoints.length, 2);

  const outcome = evaluateSmartSelection(
    [
      {
        id: '1',
        subscriptionId: 'sub1',
        subscriptionName: 'Test',
        name: 'Legacy-OVPN',
        countryCode: null,
        countryFlag: null,
        countryName: null,
        city: null,
        group: 'Test',
        protocol: 'OpenVPN',
        supported: false,
        hostRedacted: 'leg***com',
        port: 1194,
        available: false,
        probeLatencyMs: null,
        measurementSource: 'unsupported_protocol',
      },
      {
        id: '2',
        subscriptionId: 'sub1',
        subscriptionName: 'Test',
        name: 'DE-Berlin',
        countryCode: 'DE',
        countryFlag: '🇩🇪',
        countryName: 'Germany',
        city: null,
        group: 'Test',
        protocol: 'Trojan',
        supported: true,
        hostRedacted: 'de.***com',
        port: 443,
        available: null,
        probeLatencyMs: null,
        measurementSource: 'unavailable',
      },
    ],
    'automatic',
    { favoriteIds: new Set() },
  );

  assert.equal(outcome.selectedServer?.id, '2');
  assert.equal(outcome.excludedUnsupportedCount, 1);
  assert.equal(outcome.reasonCode, 'SELECTED_COMPATIBLE_NO_LATENCY');
});

test('Gateway router exposes health/version and enforces auth + honest NOT_CONNECTED 503', async () => {
  const app = express();
  const registry = new PasarGuardAdapterRegistry([]);
  assert.equal(registry.getAdapter('default') instanceof NotConnectedPasarGuardAdapter, true);

  app.use(
    '/api/v1',
    createGatewayRouter({
      pasarguard: registry,
      reseller: new NotConnectedResellerAdapter(),
      store: new InMemoryGatewayStore(),
    }),
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const base = `http://127.0.0.1:${addr.port}/api/v1`;

    const healthRes = await fetch(`${base}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as {
      adapters: { pasarguard: { status: string }; reseller: { status: string } };
    };
    assert.equal(healthJson.adapters.pasarguard.status, 'NOT_CONNECTED');
    assert.equal(healthJson.adapters.reseller.status, 'NOT_CONNECTED');

    const versionRes = await fetch(`${base}/app/version?platform=android&currentVersion=0.3.0`);
    assert.equal(versionRes.status, 200);
    const versionJson = (await versionRes.json()) as { platform: string; mandatoryUpdate: boolean };
    assert.equal(versionJson.platform, 'android');
    assert.equal(versionJson.mandatoryUpdate, false);

    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'asis_user',
        password: 'password123',
        device: { deviceId: 'dev_test_01', platform: 'android' },
      }),
    });
    assert.equal(loginRes.status, 503);
    const loginErr = (await loginRes.json()) as { error: { code: string } };
    assert.equal(loginErr.error.code, 'RESELLER_NOT_CONNECTED');

    const unauthSubsRes = await fetch(`${base}/subscriptions`);
    assert.equal(unauthSubsRes.status, 401);
    const unauthErr = (await unauthSubsRes.json()) as { error: { code: string } };
    assert.equal(unauthErr.error.code, 'AUTH_MISSING_TOKEN');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});

test('Country flag detector supports Persian, English, Unicode flags, and custom servers', () => {
  const de = inferCountryMetadata('آلمان اختصاصی 01');
  assert.equal(de.countryCode, 'DE');
  assert.equal(de.countryFlag, '🇩🇪');

  const tr = inferCountryMetadata('TR-Istanbul-Fast');
  assert.equal(tr.countryCode, 'TR');
  assert.equal(tr.countryFlag, '🇹🇷');

  const pt = inferCountryMetadata('🇵🇹 Lisbon Edge');
  assert.equal(pt.countryCode, 'PT');
  assert.equal(pt.countryFlag, '🇵🇹');

  const merged = buildServerCatalogFromSubscriptions([], [
    {
      id: 'custom_1',
      name: 'My Frankfurt Node',
      countryCode: 'DE',
      countryFlag: '🇩🇪',
      countryName: 'Germany',
      protocol: 'VLESS',
      supported: true,
      hostRedacted: 'fra***com',
      port: 443,
      createdAt: new Date().toISOString(),
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].isCustom, true);
  assert.equal(merged[0].countryCode, 'DE');
});

test('Traffic usage normalization scales units, clamps negatives, and parses /api/v1/usage history', () => {
  const GiB = 1024 ** 3;
  const parsed = normalizeAuthoritativeUsageResponse(
    {
      source: 'server_authoritative',
      subscriptionId: 'sub_99',
      providerInstanceId: 'primary',
      usedTrafficBytes: 15 * GiB,
      dataLimitBytes: 50 * GiB,
      downloadTrafficBytes: 12 * GiB,
      uploadTrafficBytes: 3 * GiB,
      expiresAt: null,
      recordedAt: '2026-11-26T12:00:00.000Z',
      granularity: '7d',
      history: [
        {
          timestamp: '2026-11-25T00:00:00.000Z',
          downloadBytes: 2.5 * GiB,
          uploadBytes: 0.5 * GiB,
        },
        {
          timestamp: '2026-11-26T00:00:00.000Z',
          downloadBytes: -100,
          uploadBytes: 1.5 * GiB,
        },
      ],
    },
    '7d',
  );

  assert.ok(parsed);
  assert.equal(parsed.subscriptionId, 'sub_99');
  assert.equal(parsed.history?.length, 2);
  assert.equal(parsed.history?.[1].downloadBytes, 0);

  const normalized = normalizeUsageHistory(parsed.history ?? [], '7d', 'en-US');
  assert.equal(normalized.unit, 'GB');
  assert.equal(normalized.series.length, 2);
  assert.equal(normalized.series[0].downloadScaled, 2.5);
  assert.equal(normalized.series[0].uploadScaled, 0.5);
  assert.equal(normalized.totalDownloadBytes, 2.5 * GiB);
  assert.equal(normalized.totalUploadBytes, 2 * GiB);
  assert.equal(normalized.peakBucketBytes, 3 * GiB);

  const quota = computeQuotaBreakdown(50 * GiB, 15 * GiB);
  assert.equal(quota.remainingBytes, 35 * GiB);
  assert.equal(quota.usedPercent, 30);
});

test('Gateway /usage returns AuthoritativeUsageSnapshot with history buckets when adapter is connected', async () => {
  const mockPasarguard = {
    instanceId: 'primary',
    label: 'Primary Mock',
    connectionState: 'CONNECTED' as const,
    async getUserRecord(username: string) {
      return {
        username,
        providerInstanceId: 'primary',
        status: 'active' as const,
        usedTrafficBytes: 2_147_483_648,
        dataLimitBytes: 10_737_418_240,
        downloadTrafficBytes: 1_610_612_736,
        uploadTrafficBytes: 536_870_912,
        usageHistory: [
          {
            timestamp: '2026-11-26T10:00:00.000Z',
            downloadBytes: 1_073_741_824,
            uploadBytes: 268_435_456,
            totalBytes: 1_342_177_280,
          },
        ],
        expiresAt: null,
      };
    },
    async getSubscriptionLinks() {
      return { providerInstanceId: 'primary', rawLinks: [], fetchedAt: new Date().toISOString() };
    },
    async verifyHealth() {
      return { ok: true, status: 'CONNECTED' as const, message: 'ok' };
    },
  };

  const registry = new PasarGuardAdapterRegistry([]);
  // Override getAdapter via minimal registry wrapper matching PasarGuardAdapterRegistry contract
  const customRegistry = {
    getAdapter: () => mockPasarguard,
    listSummaries: () => registry.listSummaries(),
  } as unknown as PasarGuardAdapterRegistry;

  const app = express();
  app.use(
    '/api/v1',
    createGatewayRouter({
      pasarguard: customRegistry,
      reseller: new NotConnectedResellerAdapter(),
      store: new InMemoryGatewayStore(),
    }),
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const { token } = signAccessToken({ sub: 'usr_1', username: 'alice', deviceId: 'dev_1' });
    const res = await fetch(
      `http://127.0.0.1:${addr.port}/api/v1/usage?granularity=24h&subscriptionId=sub_1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      source: string;
      granularity: string;
      subscriptionId?: string;
      history: Array<{ downloadBytes: number; uploadBytes: number; totalBytes: number }>;
    };
    assert.equal(body.source, 'server_authoritative');
    assert.equal(body.granularity, '24h');
    assert.equal(body.subscriptionId, 'sub_1');
    assert.equal(body.history.length, 1);
    assert.equal(body.history[0].downloadBytes, 1_073_741_824);
    assert.equal(body.history[0].uploadBytes, 268_435_456);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});

test('Split Tunneling App Selection toggles VPN access, filters apps, and validates custom identifiers', () => {
  const apps = [
    {
      id: 'com.android.chrome',
      name: 'Google Chrome',
      identifier: 'com.android.chrome',
      category: 'browser' as const,
      source: 'native_bridge' as const,
    },
    {
      id: 'org.telegram.messenger',
      name: 'Telegram',
      identifier: 'org.telegram.messenger',
      category: 'messaging' as const,
      source: 'native_bridge' as const,
    },
    {
      id: 'com.android.systemui',
      name: 'System UI',
      identifier: 'com.android.systemui',
      category: 'system' as const,
      isSystemApp: true,
      source: 'native_bridge' as const,
    },
  ];

  // Exclude mode: empty list means all apps route through VPN
  assert.equal(isAppRoutedThroughVpn('com.android.chrome', 'exclude_selected', []), true);
  const bypassed = toggleAppVpnAccess('com.android.chrome', false, 'exclude_selected', []);
  assert.deepEqual(bypassed, ['com.android.chrome']);
  assert.equal(isAppRoutedThroughVpn('com.android.chrome', 'exclude_selected', bypassed), false);
  assert.equal(
    isAppRoutedThroughVpn('org.telegram.messenger', 'exclude_selected', bypassed),
    true,
  );

  // Include mode: only listed apps route through VPN
  const included = toggleAppVpnAccess('org.telegram.messenger', true, 'include_selected', []);
  assert.deepEqual(included, ['org.telegram.messenger']);
  assert.equal(
    isAppRoutedThroughVpn('org.telegram.messenger', 'include_selected', included),
    true,
  );
  assert.equal(isAppRoutedThroughVpn('com.android.chrome', 'include_selected', included), false);

  // Filtering excludes system apps unless showSystemApps=true
  const visibleDefault = filterInstalledApps(apps, {
    query: '',
    filterMode: 'vpn',
    showSystemApps: false,
    ruleMode: 'exclude_selected',
    selectedAppIds: bypassed,
  });
  assert.equal(visibleDefault.length, 1);
  assert.equal(visibleDefault[0].id, 'org.telegram.messenger');

  // Bulk disable VPN on visible apps in exclude mode adds them to excluded list
  const bulkDisabled = setAllAppsVpnAccess(visibleDefault, false, 'exclude_selected', bypassed);
  assert.equal(isAppRoutedThroughVpn('org.telegram.messenger', 'exclude_selected', bulkDisabled), false);

  // Custom rule validation
  const bad = validateCustomAppRule('Bad App', '../etc/passwd', 'other');
  assert.equal(bad.valid, false);
  assert.equal(bad.errorCode, 'IDENTIFIER_INVALID');

  const good = validateCustomAppRule('Steam Client', 'steam.exe', 'media');
  assert.equal(good.valid, true);
  assert.equal(good.entry?.id, 'steam.exe');
});

test('Probe SSRF guard blocks private/loopback hosts & invalid ports, while latency hydration updates catalog', async () => {
  await assert.rejects(
    () => assertSafeProbeTarget('127.0.0.1', 443),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_BLOCKED_HOST',
  );
  await assert.rejects(
    () => assertSafeProbeTarget('192.168.1.1', 443),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_BLOCKED_HOST',
  );
  await assert.rejects(
    () => assertSafeProbeTarget('10.0.0.5', 443),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_BLOCKED_HOST',
  );
  await assert.rejects(
    () => assertSafeProbeTarget('::1', 443),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_BLOCKED_HOST',
  );
  await assert.rejects(
    () => assertSafeProbeTarget('localhost', 443),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_BLOCKED_HOST',
  );
  await assert.rejects(
    () => assertSafeProbeTarget('1.1.1.1', 0),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_INVALID_PORT',
  );
  await assert.rejects(
    () => assertSafeProbeTarget('1.1.1.1', 70000),
    (err: unknown) => err instanceof GatewayError && err.code === 'PROBE_INVALID_PORT',
  );

  const safePublic = await assertSafeProbeTarget('1.1.1.1', 443);
  assert.deepEqual(safePublic, { host: '1.1.1.1', port: 443 });

  assert.equal(getLatencyTier(42, true), 'fast');
  assert.equal(getLatencyTier(185, true), 'medium');
  assert.equal(getLatencyTier(340, true), 'slow');
  assert.equal(getLatencyTier(null, false), 'unreachable');
  assert.equal(getLatencyTier(null, null), 'untested');

  const hydrated = buildServerCatalogFromSubscriptions(
    [],
    [
      {
        id: 'custom_probe_1',
        name: 'Frankfurt Edge',
        countryCode: 'DE',
        countryFlag: '🇩🇪',
        countryName: 'Germany',
        protocol: 'VLESS',
        supported: true,
        hostRedacted: 'fra***net',
        probeHost: 'fra.example.net',
        port: 443,
        createdAt: new Date().toISOString(),
      },
    ],
    {
      custom_probe_1: {
        latencyMs: 64,
        available: true,
        measuredAt: '2026-11-26T14:00:00.000Z',
      },
    },
  );

  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0].probeLatencyMs, 64);
  assert.equal(hydrated[0].available, true);
  assert.equal(hydrated[0].measurementSource, 'gateway_tcp_probe');
});

test('measureTcpLatencyMs measures real TCP connect RTT and POST /servers/probe validates + blocks SSRF targets', async () => {
  // 1. Real TCP handshake timing on ephemeral local socket
  const tcpServer = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => tcpServer.listen(0, '127.0.0.1', resolve));

  try {
    const tcpAddr = tcpServer.address();
    assert.ok(tcpAddr && typeof tcpAddr === 'object');
    const okProbe = await measureTcpLatencyMs('127.0.0.1', tcpAddr.port, 1500);
    assert.equal(okProbe.available, true);
    assert.equal(typeof okProbe.latencyMs, 'number');
    assert.ok((okProbe.latencyMs ?? 0) >= 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      tcpServer.close((err) => (err ? reject(err) : resolve())),
    );
  }

  // 2. Gateway POST /api/v1/servers/probe validation & SSRF rejection
  const app = express();
  app.use(
    '/api/v1',
    createGatewayRouter({
      pasarguard: new PasarGuardAdapterRegistry([]),
      reseller: new NotConnectedResellerAdapter(),
      store: new InMemoryGatewayStore(),
    }),
  );

  const httpServer = http.createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

  try {
    const addr = httpServer.address();
    assert.ok(addr && typeof addr === 'object');
    const probeUrl = `http://127.0.0.1:${addr.port}/api/v1/servers/probe`;

    // Unauthenticated probing must be rejected (open port-scanner prevention).
    const anonRes = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: [{ id: 'x', host: '1.1.1.1', port: 443 }] }),
    });
    assert.equal(anonRes.status, 401);

    const { token: probeToken } = signAccessToken({ sub: 'cust_probe', username: 'probeuser', deviceId: 'device_probe_1' });
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${probeToken}` };

    const emptyRes = await fetch(probeUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ targets: [] }),
    });
    assert.equal(emptyRes.status, 400);

    const tooManyRes = await fetch(probeUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        targets: Array.from({ length: 16 }, (_, idx) => ({
          id: `srv_${idx}`,
          host: '127.0.0.1',
          port: 443,
        })),
      }),
    });
    assert.equal(tooManyRes.status, 400);

    const ssrfRes = await fetch(probeUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        targets: [
          { id: 'srv_local', host: '127.0.0.1', port: 443 },
          { id: 'srv_meta', host: '169.254.169.254', port: 80 },
        ],
      }),
    });
    assert.equal(ssrfRes.status, 200);
    const ssrfBody = (await ssrfRes.json()) as {
      measurementSource: string;
      results: Array<{ id: string; available: boolean; latencyMs: number | null; error?: string }>;
    };
    assert.equal(ssrfBody.measurementSource, 'gateway_tcp_probe');
    assert.equal(ssrfBody.results.length, 2);
    assert.equal(ssrfBody.results[0].available, false);
    assert.equal(ssrfBody.results[0].latencyMs, null);
    assert.equal(ssrfBody.results[0].error, 'PROBE_BLOCKED_HOST');
    assert.equal(ssrfBody.results[1].available, false);
    assert.equal(ssrfBody.results[1].error, 'PROBE_BLOCKED_HOST');
  } finally {
    await new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    );
  }
});

test('themeEngine dynamically toggles CSS variables across Azure, Emerald, and Titanium in light and dark modes', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('unknown'), 'dark');
  assert.equal(normalizeThemePalette('emerald'), 'emerald');
  assert.equal(normalizeThemePalette('titanium'), 'titanium');
  assert.equal(normalizeThemePalette('violet'), 'violet');
  assert.equal(normalizeThemePalette('invalid'), 'azure');

  const classes = new Set<string>();
  const attrs: Record<string, string> = {};
  const cssProps: Record<string, string> = {};

  const mockRoot: StyleTargetElement = {
    classList: {
      add: (token) => classes.add(token),
      remove: (token) => classes.delete(token),
    },
    setAttribute: (name, value) => {
      attrs[name] = value;
    },
    style: {
      colorScheme: '',
      setProperty: (name, value) => {
        cssProps[name] = value;
      },
    },
  };

  // Switch to Dark + Azure
  applyThemeToDocument(mockRoot, 'dark', 'azure');
  assert.equal(classes.has('dark'), true);
  assert.equal(attrs['data-palette'], 'azure');
  assert.equal(mockRoot.style.colorScheme, 'dark');
  assert.equal(cssProps['--asis-primary'], '#1D86FF');
  assert.equal(cssProps['--asis-bg'], '#050811');

  // Switch to Dark + Emerald
  applyThemeToDocument(mockRoot, 'dark', 'emerald');
  assert.equal(attrs['data-palette'], 'emerald');
  assert.equal(cssProps['--asis-primary'], '#10B981');
  assert.equal(cssProps['--asis-bg'], '#040B09');

  // Switch to Light + Titanium
  applyThemeToDocument(mockRoot, 'light', 'titanium');
  assert.equal(classes.has('dark'), false);
  assert.equal(attrs['data-palette'], 'titanium');
  assert.equal(mockRoot.style.colorScheme, 'light');
  assert.equal(cssProps['--asis-primary'], '#D97706');
  assert.equal(cssProps['--asis-bg'], '#F5F5F8');

  // Verify every palette defines a full, distinct primary & chart set
  const azureDark = resolveThemeCssVariables('dark', 'azure');
  const emeraldDark = resolveThemeCssVariables('dark', 'emerald');
  const titaniumDark = resolveThemeCssVariables('dark', 'titanium');
  assert.notEqual(azureDark['--asis-primary'], emeraldDark['--asis-primary']);
  assert.notEqual(emeraldDark['--asis-primary'], titaniumDark['--asis-primary']);
  assert.notEqual(azureDark['--asis-chart-primary'], titaniumDark['--asis-chart-primary']);
  const violetDark = resolveThemeCssVariables('dark', 'violet');
  assert.equal(violetDark['--asis-primary'], '#8B5CF6');
  for (const other of [azureDark, emeraldDark, titaniumDark]) {
    assert.notEqual(violetDark['--asis-primary'], other['--asis-primary']);
  }
});

test('isBlockedIp blocks private, reserved, and IPv4-mapped IPv6 targets but allows public IPs', () => {
  for (const ip of [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc00::1',
    '::ffff:127.0.0.1', '::ffff:172.16.0.1', '::ffff:100.64.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe',
    '64:ff9b::7f00:1', 'not-an-ip',
  ]) {
    assert.equal(isBlockedIp(ip), true, `${ip} should be blocked`);
  }
  for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isBlockedIp(ip), false, `${ip} should be allowed`);
  }
});

test('validateSubscriptionImportUrl rejects embedded credentials', () => {
  assert.throws(() => validateSubscriptionImportUrl('https://user:pass@sub.example.com/x'));
});

test('verifyAccessToken rejects tokens with a non-HS256 header', () => {
  const { token } = signAccessToken({ sub: 'u1', username: 'user1', deviceId: 'dev12345' });
  const [, body, sig] = token.split('.');
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  assert.throws(() => verifyAccessToken(`${noneHeader}.${body}.${sig}`));
});

test('SqliteGatewayStore keeps sessions across reopen and enforces rotation + revocation', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asis-db-'));
  const file = path.join(dir, 'asis.db');
  const env = { ASIS_DB_KEY: 'k'.repeat(40) } as NodeJS.ProcessEnv;
  try {
    const a = new SqliteGatewayStore(file, env);
    a.registerDevice('usr_1', { deviceId: 'dev_1', deviceName: 'Pixel', platform: 'android', appVersion: '0.3.2' });
    const first = a.issueRefreshSession('usr_1', 'alice', 'dev_1');
    a.close();

    // Reopen: the refresh token still works (restart must not log users out).
    const b = new SqliteGatewayStore(file, env);
    assert.equal(b.listDevices('usr_1', 'dev_1').length, 1);
    assert.equal(b.rotateRefreshToken(first.refreshToken, 'wrong_dev'), null);
    const second = b.issueRefreshSession('usr_1', 'alice', 'dev_1');
    const rotated = b.rotateRefreshToken(second.refreshToken, 'dev_1');
    assert.ok(rotated);
    // Replay of the old token revokes the whole family.
    assert.equal(b.rotateRefreshToken(second.refreshToken, 'dev_1'), null);
    assert.equal(b.rotateRefreshToken(rotated.refreshToken, 'dev_1'), null);

    // Device revocation kills its sessions.
    const third = b.issueRefreshSession('usr_1', 'alice', 'dev_1');
    assert.equal(b.revokeDevice('usr_1', 'dev_1'), true);
    assert.equal(b.isDeviceRevoked('usr_1', 'dev_1'), true);
    assert.equal(b.rotateRefreshToken(third.refreshToken, 'dev_1'), null);
    assert.equal(b.revokeDevice('usr_1', 'nope'), false);

    // Imported subscriptions: dedupe, user scoping, encrypted at rest.
    b.saveImportedSubscription({
      id: 'imp_1', userId: 'usr_1', name: 'My sub', urlHash: 'h1',
      sourceUrl: 'https://sub.example.com/secret-token',
      createdAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString(),
    });
    assert.equal(b.findImportedDuplicate('usr_1', 'h1')?.sourceUrl, 'https://sub.example.com/secret-token');
    assert.equal(b.findImportedDuplicate('usr_2', 'h1'), undefined);
    assert.equal(b.listImportedSubscriptions('usr_1').length, 1);
    assert.equal(b.deleteImportedSubscription('usr_2', 'imp_1'), false);
    assert.equal(b.deleteImportedSubscription('usr_1', 'imp_1'), true);
    b.close();
    assert.equal(fs.readFileSync(file).includes('secret-token'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('PasarGuard subscription-link login: allowlist, info mapping, configs, persistence', async () => {
  const TOKEN = 'abcDEF123456.signature_XYZ';
  const seen: string[] = [];
  const panel = http.createServer((req, res) => {
    seen.push(String(req.url));
    if (req.url === `/sub/${TOKEN}/info`) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        username: 'alice', status: 'active', used_traffic: 2_147_483_648,
        data_limit: 10_737_418_240, expire: 1_900_000_000, created_at: '2026-01-01T00:00:00Z',
      }));
    } else if (req.url === `/sub/${TOKEN}`) {
      const uris = ['vless://u@de.example.com:443?security=tls#DE', 'trojan://p@nl.example.com:443#NL'].join('\n');
      res.end(Buffer.from(uris).toString('base64'));
    } else if (String(req.url).startsWith('/sub/redir')) {
      res.statusCode = 302; res.setHeader('location', 'http://127.0.0.1:1/'); res.end();
    } else { res.statusCode = 404; res.end('nope'); }
  });
  await new Promise<void>((r) => panel.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(panel.address() as any).port}`;
  try {
    const registry = new PasarGuardAdapterRegistry([{ instanceId: 'primary', label: 'P', baseUrl: base }]);
    const store = new InMemoryGatewayStore();

    // Links outside the configured prefix are refused WITHOUT any upstream request (SSRF guard).
    for (const bad of [
      `http://127.0.0.1:9/sub/${TOKEN}`, `${base}/other/${TOKEN}`, `${base}/sub/`, `${base}/sub/a/b`,
      `${base}/sub/short`, `http://user:pw@${base.slice(7)}/sub/${TOKEN}`, 'not a url', `file:///etc/passwd`,
    ]) {
      await assert.rejects(authenticateWithLink(registry, store, bad), (e: any) => e.code === 'AUTH_LINK_INVALID');
    }
    assert.equal(seen.length, 0);

    // Valid link (with and without trailing /info or query string).
    const login = await authenticateWithLink(registry, store, `${base}/sub/${TOKEN}?x=1`);
    assert.equal(login.userId, 'pg:primary:alice');
    assert.equal(login.record.usedTrafficBytes, 2_147_483_648);
    assert.equal(login.record.dataLimitBytes, 10_737_418_240);
    assert.equal(login.record.expiresAt, new Date(1_900_000_000 * 1000).toISOString());
    assert.equal((await authenticateWithLink(registry, store, `${base}/sub/${TOKEN}/info`)).userId, login.userId);

    const ctx = getLinkedContext(registry, store, login.userId)!;
    assert.equal(ctx.account.subscriptionToken, TOKEN);
    const sub = recordToSubscription(await ctx.fetchRecord(), 'primary');
    assert.equal(sub.type, 'combined');
    assert.equal(sub.remainingBytes, 10_737_418_240 - 2_147_483_648);
    const links = await ctx.fetchLinks();
    assert.equal(links.rawLinks.length, 2);
    assert.ok(links.rawLinks[0].startsWith('vless://'));
    assert.equal(getLinkedContext(registry, store, 'pg:primary:nobody'), null);

    // Panel says 404 -> rejected link; redirects are never followed.
    await assert.rejects(authenticateWithLink(registry, store, `${base}/sub/unknownTOKEN1234`), (e: any) => e.code === 'AUTH_LINK_REJECTED');
    await assert.rejects(authenticateWithLink(registry, store, `${base}/sub/redirect12345`), (e: any) => e.code === 'PASARGUARD_UPSTREAM_UNAVAILABLE' || e.code === 'AUTH_LINK_REJECTED');

    // SQLite keeps the linked account across restart, token encrypted at rest.
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asis-link-'));
    const file = path.join(dir, 'a.db');
    const env = { ASIS_DB_KEY: 'k'.repeat(40) } as NodeJS.ProcessEnv;
    try {
      const s1 = new SqliteGatewayStore(file, env);
      await authenticateWithLink(registry, s1, `${base}/sub/${TOKEN}`);
      s1.close();
      const s2 = new SqliteGatewayStore(file, env);
      assert.equal(s2.getLinkedAccount('pg:primary:alice')?.subscriptionToken, TOKEN);
      s2.close();
      assert.equal(fs.readFileSync(file).includes(TOKEN), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  } finally { panel.close(); }
});

test('PasarGuard subscription-link login: panel down -> 502, not-configured -> invalid link', async () => {
  const registry = new PasarGuardAdapterRegistry([{ instanceId: 'primary', label: 'P', baseUrl: 'http://127.0.0.1:1' }]);
  await assert.rejects(
    authenticateWithLink(registry, new InMemoryGatewayStore(), 'http://127.0.0.1:1/sub/abcdefgh12345'),
    (e: any) => e.statusCode === 502 && e.code === 'PASARGUARD_UPSTREAM_UNAVAILABLE',
  );
  await assert.rejects(
    authenticateWithLink(new PasarGuardAdapterRegistry([]), new InMemoryGatewayStore(), 'https://x.example.com/sub/abcdefgh12345'),
    (e: any) => e.code === 'AUTH_LINK_INVALID',
  );
});

test('linksToServers builds a server list without hosts or credentials', async () => {
  const { linksToServers } = await import('../src/gateway/linkedAccount.ts');
  const items = linksToServers(['vless://uuid@de.example.com:443?security=tls#DE%20Berlin', 'trojan://pw@nl.example.com:443'], 'acct_primary');
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'DE Berlin');
  assert.deepEqual(items[0].protocols, ['vless']);
  assert.equal(items[1].name, 'TROJAN Node 2');
  assert.equal(items[0].id, 'acct_primary:0');
  assert.equal(JSON.stringify(items).includes('example.com'), false);
  assert.equal(JSON.stringify(items).includes('uuid'), false);
});


test('parseTunnelTag detects explicit tunnel markers only', () => {
  assert.deepEqual(parseTunnelTag('Fast [TUN IR>DE]'), {
    entryCountryCode: 'IR',
    exitCountryCode: 'DE',
    cleanName: 'Fast',
  });
  assert.equal(parseTunnelTag('[tunnel ir->nl] Node 2')?.exitCountryCode, 'NL');
  assert.equal(parseTunnelTag('[TUN DE]')?.entryCountryCode, 'IR');
  assert.equal(parseTunnelTag('Iran Direct Node'), null);
  assert.equal(parseTunnelTag('Germany TUN'), null);
});

test('evaluateExit flags Iranian exit IP for a foreign server and accepts a match', async () => {
  const { evaluateExit } = await import('../src/features/home/exitCheck.ts');
  const exit = (countryCode: string | null) => ({ ip: '203.0.113.9', countryCode, source: 'ipwho.is' as const });
  assert.equal(evaluateExit({ countryCode: 'DE' }, exit('DE')), 'ok');
  assert.equal(evaluateExit({ countryCode: 'DE' }, exit('IR')), 'leak');
  assert.equal(evaluateExit({ countryCode: 'DE' }, exit('NL')), 'mismatch');
  assert.equal(evaluateExit({ countryCode: 'IR' }, exit('IR')), 'ok');
  assert.equal(evaluateExit({ countryCode: 'DE' }, exit(null)), 'unknown');
  assert.equal(evaluateExit({ countryCode: null }, exit('DE')), 'unknown');
  assert.equal(evaluateExit({ countryCode: 'DE' }, null), 'unknown');
});


test('probeFromPhone normalises native results and falls back to null without the bridge', async () => {
  const { probeFromPhone } = await import('../src/features/servers/phoneProbe.ts');
  const g = globalThis as unknown as { window?: unknown };
  const saved = g.window;
  try {
    g.window = undefined;
    assert.equal(await probeFromPhone([{ id: 'a', host: '1.2.3.4', port: 443 }]), null);

    g.window = {
      AsisNativeBridge: {
        tcpProbe: async () => [
          { id: 'a', latencyMs: 41.6, available: true },
          { id: 'b', latencyMs: null, available: false, error: 'timeout' },
          { id: 'c', latencyMs: -5, available: true },
          { id: 'zzz', latencyMs: 10, available: true },
        ],
      },
    };
    const out = await probeFromPhone([
      { id: 'a', host: '1.2.3.4', port: 443 },
      { id: 'b', host: '5.6.7.8', port: 443 },
      { id: 'c', host: '9.9.9.9', port: 443 },
    ]);
    assert.deepEqual(out, [
      { id: 'a', available: true, latencyMs: 42 },
      { id: 'b', available: false, latencyMs: null, error: 'timeout' },
      { id: 'c', available: false, latencyMs: null, error: 'unreachable' },
    ]);

    g.window = { AsisNativeBridge: { tcpProbe: async () => { throw new Error('boom'); } } };
    assert.equal(await probeFromPhone([{ id: 'a', host: '1.2.3.4', port: 443 }]), null);
  } finally {
    g.window = saved;
  }
});

test('catalog keeps the probe source (phone vs gateway)', () => {
  const sub = {
    id: 's1', name: 'S', status: 'active',
    endpoints: [{ id: 'a', name: 'DE 1', protocol: 'VLESS', supported: true, hostRedacted: 'x', probeHost: '1.2.3.4', port: 443, countryHint: null }],
  } as unknown as Parameters<typeof buildServerCatalogFromSubscriptions>[0][number];
  const phone = buildServerCatalogFromSubscriptions([sub], [], {
    's1:a': { latencyMs: 40, available: true, measuredAt: 'now', source: 'phone_tcp_probe' },
  });
  assert.equal(phone[0].measurementSource, 'phone_tcp_probe');
  const legacy = buildServerCatalogFromSubscriptions([sub], [], {
    's1:a': { latencyMs: 40, available: true, measuredAt: 'now' },
  });
  assert.equal(legacy[0].measurementSource, 'gateway_tcp_probe');
});
