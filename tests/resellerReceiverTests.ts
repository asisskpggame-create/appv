import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import { HttpResellerAdapter, signResellerRequest } from '../src/gateway/adapters/resellerAdapter.ts';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../src/gateway/passwords.ts';
import { createVerifyLoginHandler, type CustomerRecord } from '../reference/verify-login-receiver/receiver.ts';

const KEY = 'k'.repeat(40);
const LINK = 'https://panel.example.com/sub/AbCdEfGhIjKl';

let server: http.Server;
let base = '';
const customers = new Map<string, CustomerRecord>();
let lookups = 0;

before(async () => {
  customers.set('ali', { customerId: '42', username: 'ali', status: 'active', subscriptionUrl: LINK, allowedDevices: 3, passwordHash: await hashPassword('correct-horse') });
  customers.set('bob', { customerId: '44', username: 'bob', status: 'active', subscriptionUrl: LINK, passwordHash: await hashPassword('correct-horse') });
  customers.set('sus', { customerId: '43', username: 'sus', status: 'suspended', subscriptionUrl: LINK, passwordHash: await hashPassword('correct-horse') });
  const handle = createVerifyLoginHandler({
    apiKey: KEY,
    lookup: async (u) => {
      lookups += 1;
      return customers.get(u) ?? null;
    },
    verifyPassword,
    burnPasswordCheck: verifyAgainstDummy,
    now: () => Date.now(),
    failureWindowMs: 1500,
  });
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      if (req.method !== 'POST' || req.url !== '/asis/verify-login') {
        res.writeHead(404).end();
        return;
      }
      const out = await handle(
        { 'x-asis-timestamp': req.headers['x-asis-timestamp'] as string, 'x-asis-signature': req.headers['x-asis-signature'] as string },
        Buffer.concat(chunks).toString('utf8'),
      );
      res.writeHead(out.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(out.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/asis`;
});
after(() => server.close());

const adapter = () => new HttpResellerAdapter(base, KEY);

test('the gateway adapter and the reference receiver agree: good login returns the customer', async () => {
  const c = await adapter().authenticateEndUser('Ali', 'correct-horse');
  assert.equal(c.username, 'ali');
  assert.equal(c.customerId, '42');
  assert.equal(c.status, 'active');
  assert.equal(c.allowedDevices, 3);
  assert.equal(c.subscriptionUrl, LINK);
  assert.equal((await adapter().authenticateEndUser('sus', 'correct-horse')).status, 'suspended');
});

test('wrong password and unknown user both end as AUTH_INVALID_CREDENTIALS', async () => {
  await assert.rejects(adapter().authenticateEndUser('ali', 'wrong-pass-1'), { code: 'AUTH_INVALID_CREDENTIALS' });
  await assert.rejects(adapter().authenticateEndUser('ghost', 'wrong-pass-1'), { code: 'AUTH_INVALID_CREDENTIALS' });
});

test('a wrong API key is refused (the gateway sees a failed login, never a success)', async () => {
  await assert.rejects(new HttpResellerAdapter(base, 'x'.repeat(40)).authenticateEndUser('ali', 'correct-horse'), { code: 'AUTH_INVALID_CREDENTIALS' });
});

async function raw(body: string, ts: string, sig: string) {
  const res = await fetch(`${base}/verify-login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ASiS-Timestamp': ts, 'X-ASiS-Signature': sig }, body });
  return res.status;
}

test('tampered body, old timestamp, missing headers and replay are all 401', async () => {
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ username: 'ali', password: 'correct-horse' });
  const sig = signResellerRequest(KEY, ts, body);
  assert.equal(await raw(JSON.stringify({ username: 'ali', password: 'other-pass-1' }), ts, sig), 401);
  const oldTs = String(Math.floor(Date.now() / 1000) - 600);
  assert.equal(await raw(body, oldTs, signResellerRequest(KEY, oldTs, body)), 401);
  assert.equal(await raw(body, '', ''), 401);
  const before = lookups;
  assert.equal(await raw(body, ts, sig), 200);
  assert.equal(await raw(body, ts, sig), 401);
  assert.equal(lookups, before + 1);
});

test('5 wrong passwords for one name -> 429, even the right password is not checked; resets after the window', async () => {
  for (let i = 0; i < 5; i += 1) await assert.rejects(adapter().authenticateEndUser('bob', `wrong-pass-${i}`), { code: 'AUTH_INVALID_CREDENTIALS' });
  const before = lookups;
  await assert.rejects(adapter().authenticateEndUser('bob', 'correct-horse'), { code: 'AUTH_RATE_LIMITED' });
  assert.equal(lookups, before, 'no customer lookup while throttled');
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal((await adapter().authenticateEndUser('bob', 'correct-horse')).username, 'bob');
});

test('the same login twice in the same second is not mistaken for a replay (nonce makes each signature unique)', async () => {
  const a = await adapter().authenticateEndUser('ali', 'correct-horse');
  const b = await adapter().authenticateEndUser('ali', 'correct-horse');
  assert.equal(a.username, 'ali');
  assert.equal(b.username, 'ali');
});
