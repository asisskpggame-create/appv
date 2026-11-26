import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import express from 'express';
import { validateAndParseOutbound } from '../src/engine/protocolValidator.ts';
import { InMemoryGatewayStore } from '../src/gateway/adapters/gatewayStore.ts';
import { NotConnectedPasarGuardAdapter, PasarGuardAdapterRegistry } from '../src/gateway/adapters/pasarguardAdapter.ts';
import { NotConnectedResellerAdapter } from '../src/gateway/adapters/resellerAdapter.ts';
import { GatewayError } from '../src/gateway/errors.ts';
import { createGatewayRouter } from '../src/gateway/router.ts';
import {
  assertSafeProbeTarget,
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

    const emptyRes = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: [] }),
    });
    assert.equal(emptyRes.status, 400);

    const tooManyRes = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
});
