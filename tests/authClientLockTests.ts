import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import express from 'express';

process.env.ASIS_JWT_SECRET = 'j'.repeat(48);

const { createGatewayRouter } = await import('../src/gateway/router.ts');
const { InMemoryGatewayStore } = await import('../src/gateway/adapters/gatewayStore.ts');
const { NotConnectedResellerAdapter } = await import('../src/gateway/adapters/resellerAdapter.ts');
const { hashPassword } = await import('../src/gateway/passwords.ts');
const { HttpAuthClient, AuthClientError } = await import('../src/features/auth/authClient.ts');
const { authTranslations } = await import('../src/features/auth/authTranslations.ts');

const PANEL = 'https://panel.example.com/sub/';
const device = { deviceId: 'device-1234', deviceName: 'Test', platform: 'web' as const, appVersion: '0.4.5' };

const adapter = {
  instanceId: 'primary',
  label: 'fake',
  connectionState: 'CONNECTED',
  parseSubscriptionLink: (raw: string) => (raw.startsWith(PANEL) ? raw.slice(PANEL.length) : null),
  fetchSubscriptionInfo: async () => ({
    username: 'pg-user',
    providerInstanceId: 'primary',
    status: 'active' as const,
    usedTrafficBytes: 0,
    dataLimitBytes: null,
    expiresAt: null,
  }),
  verifyHealth: async () => ({ ok: true, status: 'CONNECTED', message: 'fake' }),
};
const registry = {
  findForLink: (raw: string) => {
    const token = adapter.parseSubscriptionLink(raw);
    return token ? { adapter, token } : null;
  },
  getAdapter: () => adapter,
  listSummaries: () => [],
};

let server: ReturnType<ReturnType<typeof express>['listen']>;
let client: InstanceType<typeof HttpAuthClient>;

before(async () => {
  const store = new InMemoryGatewayStore();
  store.saveLocalAccount({ username: 'ali', passwordHash: await hashPassword('correct-horse'), subscriptionUrl: `${PANEL}AbCdEfGhIjKl` });
  const app = express();
  app.use('/api/v1', createGatewayRouter({ store, pasarguard: registry as never, reseller: new NotConnectedResellerAdapter() }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  client = new HttpAuthClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`);
});
after(() => server.close());

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof AuthClientError, 'expected AuthClientError');
    return err.authError;
  }
  assert.fail('expected the call to fail');
}

test('the real client turns the gateway lock answer into AUTH_ACCOUNT_LOCKED (what AuthForm shows as "Account locked")', async () => {
  const one = await failure(client.login({ username: 'ali', password: 'wrong-pass-1' }, device));
  assert.equal(one.code, 'AUTH_INVALID_CREDENTIALS');
  await failure(client.login({ username: 'ali', password: 'wrong-pass-2' }, device));
  const third = await failure(client.login({ username: 'ali', password: 'wrong-pass-3' }, device));
  assert.equal(third.code, 'AUTH_ACCOUNT_LOCKED');
  assert.equal(third.recoveryAction, 'contact_support');
  const right = await failure(client.login({ username: 'ali', password: 'correct-horse' }, device));
  assert.equal(right.code, 'AUTH_ACCOUNT_LOCKED');
});

test('locked-account texts exist in English and Persian and differ from the generic wrong-password text', () => {
  for (const locale of Object.keys(authTranslations) as Array<keyof typeof authTranslations>) {
    const t = authTranslations[locale];
    assert.ok(t.errorLockedTitle.length > 3 && t.errorLockedBody.length > 20, `${locale}: locked texts`);
    assert.notEqual(t.errorLockedTitle, t.errorInvalidCredentialsTitle);
    assert.notEqual(t.errorLockedBody, t.errorInvalidCredentialsBody);
  }
  assert.ok(Object.keys(authTranslations).length >= 2);
});
