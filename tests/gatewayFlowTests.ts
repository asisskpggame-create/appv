import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import express from 'express';

process.env.ASIS_JWT_SECRET = 'j'.repeat(48);
process.env.ADMIN_API_KEY = 'a'.repeat(40);

const { createGatewayRouter } = await import('../src/gateway/router.ts');
const { InMemoryGatewayStore } = await import('../src/gateway/adapters/gatewayStore.ts');
const { hashPassword } = await import('../src/gateway/passwords.ts');
const { GatewayError } = await import('../src/gateway/errors.ts');

const PANEL = 'https://panel.example.com/sub/';
const DEVICE = { deviceId: 'device-1234', deviceName: 'Test phone', platform: 'android' };

const fakeAdapter = {
  instanceId: 'primary',
  label: 'fake',
  connectionState: 'CONNECTED',
  parseSubscriptionLink: (raw: string) => (raw.startsWith(PANEL) ? raw.slice(PANEL.length) : null),
  fetchSubscriptionInfo: async (token: string) => ({
    username: `pg-${token.slice(0, 4).toLowerCase()}`,
    providerInstanceId: 'primary',
    status: (token.startsWith('Dis') ? 'disabled' : 'active') as 'disabled' | 'active',
    usedTrafficBytes: 0,
    dataLimitBytes: null,
    expiresAt: null,
  }),
  fetchSubscriptionLinks: async () => ({ providerInstanceId: 'primary', rawLinks: [], fetchedAt: new Date().toISOString() }),
  getUserRecord: async () => {
    throw new Error('not used');
  },
  getSubscriptionLinks: async () => {
    throw new Error('not used');
  },
  verifyHealth: async () => ({ ok: true, status: 'CONNECTED', message: 'fake' }),
};
const registry = {
  findForLink: (raw: string) => {
    const token = fakeAdapter.parseSubscriptionLink(raw);
    return token ? { adapter: fakeAdapter, token } : null;
  },
  getAdapter: () => fakeAdapter,
  listSummaries: () => [{ instanceId: 'primary', label: 'fake', status: 'CONNECTED' }],
};

// Fake reseller: "reseller-user"/"reseller-pass" works, "suspended-user" is suspended.
const reseller = {
  connectionState: 'CONNECTED' as const,
  calls: [] as string[],
  async authenticateEndUser(username: string, password: string) {
    this.calls.push(username);
    if (password !== 'reseller-pass') {
      throw new GatewayError(401, 'AUTH_INVALID_CREDENTIALS', 'authentication_failure', 'Invalid username or password.', 'verify_credentials');
    }
    return {
      customerId: `r-${username}`,
      username,
      status: username === 'suspended-user' ? ('suspended' as const) : ('active' as const),
      allowedDevices: null,
      subscriptionUrl: `${PANEL}ResellerTok1`,
    };
  },
  getCustomerProfile: async () => {
    throw new Error('not used');
  },
  getPurchasedServices: async () => [],
  requestPasswordRecovery: async () => ({ delegated: true, workflowMessage: 'reseller handles it' }),
  verifyHealth: async () => ({ ok: true, status: 'CONNECTED' as const, message: 'fake' }),
};

let server: ReturnType<ReturnType<typeof express>['listen']>;
let base = '';

before(async () => {
  const store = new InMemoryGatewayStore();
  store.saveLocalAccount({ username: 'ali', passwordHash: await hashPassword('correct-horse'), subscriptionUrl: `${PANEL}AbCdEfGhIjKl` });
  const app = express();
  app.use('/api/v1', createGatewayRouter({ store, pasarguard: registry as never, reseller: reseller as never }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
after(() => server.close());

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, code: json?.error?.code ?? json?.code };
}
const login = (username: string, password: string, device = DEVICE) => call('POST', '/auth/login', { username, password, device });

test('reseller fallback: a name that is not a gateway account goes to the reseller and ends in the link pipeline', async () => {
  const before = reseller.calls.length;
  const res = await login('reseller-user', 'reseller-pass');
  assert.equal(res.status, 200);
  assert.equal(reseller.calls.length, before + 1);
  assert.equal(res.json.user.username, 'pg-rese');
  const me = await call('GET', '/user/me', undefined, res.json.tokens.accessToken);
  assert.equal(me.status, 200);
  assert.equal(me.json.username ?? me.json.user?.username, 'pg-rese');
});

test('reseller fallback: wrong password and suspended account', async () => {
  assert.equal((await login('reseller-user', 'bad-password')).status, 401);
  const s = await login('suspended-user', 'reseller-pass');
  assert.equal(s.status, 403);
  assert.equal(s.code, 'AUTH_ACCOUNT_SUSPENDED');
});

test('a gateway account never reaches the reseller', async () => {
  const before = reseller.calls.length;
  assert.equal((await login('ali', 'correct-horse')).status, 200);
  assert.equal(reseller.calls.length, before);
});

test('refresh rotates the token; the old one is refused; logout revokes the device', async () => {
  const first = await login('ali', 'correct-horse', { ...DEVICE, deviceId: 'device-5678' });
  assert.equal(first.status, 200);
  const { accessToken, refreshToken } = first.json.tokens;
  assert.equal((await call('GET', '/user/me', undefined, accessToken)).status, 200);

  const rotated = await call('POST', '/auth/refresh', { refreshToken, deviceId: 'device-5678' });
  assert.equal(rotated.status, 200);
  assert.notEqual(rotated.json.tokens.refreshToken, refreshToken);

  const reuse = await call('POST', '/auth/refresh', { refreshToken, deviceId: 'device-5678' });
  assert.equal(reuse.status, 401);
  assert.equal(reuse.code, 'AUTH_SESSION_EXPIRED');

  const out = await call('POST', '/auth/logout', undefined, rotated.json.tokens.accessToken);
  assert.equal(out.status, 200);
  const after = await call('GET', '/user/me', undefined, rotated.json.tokens.accessToken);
  assert.equal(after.status, 401);
  assert.equal(after.code, 'AUTH_DEVICE_REVOKED');
});

test('protected routes refuse a missing or garbage token', async () => {
  assert.equal((await call('GET', '/user/me')).status, 401);
  assert.equal((await call('GET', '/user/me', undefined, 'not.a.token')).status, 401);
});

test('refresh with the wrong deviceId is refused', async () => {
  const first = await login('ali', 'correct-horse', { ...DEVICE, deviceId: 'device-9999' });
  const bad = await call('POST', '/auth/refresh', { refreshToken: first.json.tokens.refreshToken, deviceId: 'other-device' });
  assert.equal(bad.status, 401);
  assert.equal((await call('POST', '/auth/refresh', { refreshToken: first.json.tokens.refreshToken })).status, 400);
});
