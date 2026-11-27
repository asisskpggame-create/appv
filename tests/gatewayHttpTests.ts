import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import express from 'express';

// Env must be set before the gateway modules are loaded (the JWT secret is read at import time).
process.env.ASIS_JWT_SECRET = 'j'.repeat(48);
process.env.ADMIN_API_KEY = 'a'.repeat(40);

const { createGatewayRouter } = await import('../src/gateway/router.ts');
const { InMemoryGatewayStore } = await import('../src/gateway/adapters/gatewayStore.ts');
const { NotConnectedResellerAdapter } = await import('../src/gateway/adapters/resellerAdapter.ts');

const PANEL = 'https://panel.example.com/sub/';
const LINK = `${PANEL}AbCdEfGhIjKl`;
const ADMIN = { 'X-Admin-Key': 'a'.repeat(40), 'Content-Type': 'application/json' };
const DEVICE = { deviceId: 'device-1234', deviceName: 'Test phone', platform: 'android' };

// Fake panel: knows one link, answers like a PasarGuard instance, no network.
const fakeAdapter = {
  instanceId: 'primary',
  label: 'fake',
  connectionState: 'CONNECTED',
  parseSubscriptionLink: (raw: string) => (raw.startsWith(PANEL) ? raw.slice(PANEL.length) : null),
  fetchSubscriptionInfo: async (token: string) => ({
    username: `pg-${token.slice(0, 4).toLowerCase()}`,
    providerInstanceId: 'primary',
    status: 'active' as const,
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
const fakeRegistry = {
  findForLink: (raw: string) => {
    const token = fakeAdapter.parseSubscriptionLink(raw);
    return token ? { adapter: fakeAdapter, token } : null;
  },
  getAdapter: () => fakeAdapter,
  listSummaries: () => [{ instanceId: 'primary', label: 'fake', status: 'CONNECTED' }],
};

let server: ReturnType<ReturnType<typeof express>['listen']>;
let base = '';

before(async () => {
  const app = express();
  app.use(
    '/api/v1',
    createGatewayRouter({
      store: new InMemoryGatewayStore(),
      pasarguard: fakeRegistry as never,
      reseller: new NotConnectedResellerAdapter(),
    }),
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

after(() => {
  server.close();
});

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) {
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const login = (username: string, password: string) => call('POST', '/auth/login', { username, password, device: DEVICE });

test('admin API: wrong or missing key is refused', async () => {
  const none = await call('GET', '/admin/accounts/ali', undefined, {});
  assert.equal(none.status, 401);
  assert.equal(none.json.error?.code ?? none.json.code, 'ADMIN_AUTH_FAILED');
  const wrong = await call('GET', '/admin/accounts/ali', undefined, { 'X-Admin-Key': 'b'.repeat(40) });
  assert.equal(wrong.status, 401);
});

test('admin API: validates username, password and link', async () => {
  assert.equal((await call('PUT', '/admin/accounts/a', { password: 'long-enough-1', subscriptionUrl: LINK }, ADMIN)).status, 400);
  assert.equal((await call('PUT', '/admin/accounts/ali', { password: 'short', subscriptionUrl: LINK }, ADMIN)).status, 400);
  assert.equal((await call('PUT', '/admin/accounts/ali', { password: 'long-enough-1', subscriptionUrl: 'https://evil.example/sub/x' }, ADMIN)).status, 400);
  assert.equal((await call('PUT', '/admin/accounts/ali', { password: 'long-enough-1' }, ADMIN)).status, 400);
});

test('create -> login -> 3 strikes -> locked even with right password -> unlock -> login -> delete', async () => {
  const created = await call('PUT', '/admin/accounts/ali', { password: 'correct-horse', subscriptionUrl: LINK }, ADMIN);
  assert.equal(created.status, 201);
  assert.equal(created.json.locked, false);
  assert.equal(JSON.stringify(created.json).includes('correct-horse'), false);
  assert.equal(JSON.stringify(created.json).includes('AbCdEfGhIjKl'), false);
  assert.equal((await call('PUT', '/admin/accounts/ali', { password: 'correct-horse', subscriptionUrl: LINK }, ADMIN)).status, 200);

  const ok = await login('Ali', 'correct-horse');
  assert.equal(ok.status, 200);
  assert.ok(ok.json.tokens?.accessToken);
  assert.equal(ok.json.user.username, 'pg-abcd');

  assert.equal((await login('ali', 'wrong-pass-1')).status, 401);
  assert.equal((await login('ali', 'wrong-pass-2')).status, 401);
  const third = await login('ali', 'wrong-pass-3');
  assert.equal(third.status, 423);
  assert.equal(third.json.error?.code ?? third.json.code, 'AUTH_ACCOUNT_LOCKED');
  assert.equal((await login('ali', 'correct-horse')).status, 423);

  const view = await call('GET', '/admin/accounts/ali', undefined, ADMIN);
  assert.equal(view.json.locked, true);

  const unlocked = await call('POST', '/admin/accounts/ali/unlock', { newPassword: 'brand-new-pass' }, ADMIN);
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.json.locked, false);
  assert.equal((await login('ali', 'correct-horse')).status, 401);
  assert.equal((await login('ali', 'brand-new-pass')).status, 200);

  assert.equal((await call('DELETE', '/admin/accounts/ali', undefined, ADMIN)).status, 204);
  assert.equal((await call('GET', '/admin/accounts/ali', undefined, ADMIN)).status, 404);
});

test('unknown username answers like a wrong password (same status and code)', async () => {
  await call('PUT', '/admin/accounts/sara', { password: 'sara-password', subscriptionUrl: LINK }, ADMIN);
  const known = await login('sara', 'nope-nope-1');
  const unknown = await login('nobody-here', 'nope-nope-1');
  assert.equal(known.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(known.json.error?.code ?? known.json.code, unknown.json.error?.code ?? unknown.json.code);
});

test('password recovery for a gateway account does not reveal whether the name exists', async () => {
  const known = await call('POST', '/auth/password-recovery', { username: 'sara' });
  const unknown = await call('POST', '/auth/password-recovery', { username: 'nobody-here' });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(known.json?.workflowMessage ?? known.json, unknown.json?.workflowMessage ?? unknown.json);
});
