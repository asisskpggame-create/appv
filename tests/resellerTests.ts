import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { HttpResellerAdapter, mapVerifyLoginResponse, signResellerRequest } from '../src/gateway/adapters/resellerAdapter.ts';

const KEY = 'test-shared-key-0123456789';

interface Seen {
  method?: string;
  url?: string;
  timestamp?: string;
  signature?: string;
  body: string;
}

async function withStub(
  handler: (seen: Seen, res: http.ServerResponse) => void,
  run: (baseUrl: string, seen: Seen) => Promise<void>,
) {
  const seen: Seen = { body: '' };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.method = req.method;
      seen.url = req.url;
      seen.timestamp = String(req.headers['x-asis-timestamp']);
      seen.signature = String(req.headers['x-asis-signature']);
      seen.body = body;
      handler(seen, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const okJson = {
  ok: true,
  customer_id: 42,
  username: 'ali',
  status: 'active',
  subscription_url: 'https://panel.example.com/sub/AbCdEfGhIjKl',
  allowed_devices: 3,
  renewal_url: 'https://shop.example.com/renew',
};

test('reseller login: sends a verifiable HMAC signature and maps the answer', async () => {
  await withStub(
    (_seen, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(okJson));
    },
    async (baseUrl, seen) => {
      const customer = await new HttpResellerAdapter(baseUrl, KEY).authenticateEndUser('ali', 'secret-pass');
      assert.equal(seen.method, 'POST');
      assert.equal(seen.url, '/verify-login');
      const sent = JSON.parse(seen.body);
      assert.match(sent.nonce, /^[0-9a-f]{32}$/);
      assert.deepEqual({ ...sent, nonce: undefined }, { username: 'ali', password: 'secret-pass', nonce: undefined });
      assert.equal(seen.signature, signResellerRequest(KEY, seen.timestamp!, seen.body));
      assert.ok(Math.abs(Number(seen.timestamp) - Date.now() / 1000) < 5);
      assert.deepEqual(customer, {
        customerId: '42',
        username: 'ali',
        status: 'active',
        allowedDevices: 3,
        renewalUrl: 'https://shop.example.com/renew',
        subscriptionUrl: 'https://panel.example.com/sub/AbCdEfGhIjKl',
      });
    },
  );
});

test('reseller login: wrong password (401) becomes AUTH_INVALID_CREDENTIALS', async () => {
  await withStub(
    (_s, res) => {
      res.statusCode = 401;
      res.end('{}');
    },
    async (baseUrl) => {
      await assert.rejects(new HttpResellerAdapter(baseUrl, KEY).authenticateEndUser('ali', 'bad-pass'), {
        code: 'AUTH_INVALID_CREDENTIALS',
        statusCode: 401,
      });
    },
  );
});

test('reseller login: 429, 500, garbage and unreachable service never look like success', async () => {
  await withStub(
    (_s, res) => {
      res.statusCode = 429;
      res.end('{}');
    },
    async (baseUrl) => {
      await assert.rejects(new HttpResellerAdapter(baseUrl, KEY).authenticateEndUser('ali', 'x1x1x1'), { code: 'AUTH_RATE_LIMITED' });
    },
  );
  await withStub(
    (_s, res) => {
      res.statusCode = 500;
      res.end('boom');
    },
    async (baseUrl) => {
      await assert.rejects(new HttpResellerAdapter(baseUrl, KEY).authenticateEndUser('ali', 'x1x1x1'), { code: 'RESELLER_UPSTREAM_UNAVAILABLE' });
    },
  );
  await withStub(
    (_s, res) => res.end('not json'),
    async (baseUrl) => {
      await assert.rejects(new HttpResellerAdapter(baseUrl, KEY).authenticateEndUser('ali', 'x1x1x1'), { code: 'RESELLER_UPSTREAM_UNAVAILABLE' });
    },
  );
  await assert.rejects(new HttpResellerAdapter('http://127.0.0.1:1', KEY).authenticateEndUser('ali', 'x1x1x1'), {
    code: 'RESELLER_UPSTREAM_UNAVAILABLE',
  });
  await assert.rejects(new HttpResellerAdapter('http://127.0.0.1:1', '').authenticateEndUser('ali', 'x1x1x1'), {
    code: 'RESELLER_NOT_CONNECTED',
  });
});

test('mapVerifyLoginResponse: rejects incomplete answers, keeps suspended, drops non-https renewal links', () => {
  assert.throws(() => mapVerifyLoginResponse({ ok: false }), { code: 'AUTH_INVALID_CREDENTIALS' });
  assert.throws(() => mapVerifyLoginResponse({ ok: true, username: 'ali' }), { code: 'RESELLER_UPSTREAM_UNAVAILABLE' });
  assert.throws(() => mapVerifyLoginResponse({ username: 'ali', subscription_url: 'https://x/sub/abcdefgh' }), {
    code: 'RESELLER_UPSTREAM_UNAVAILABLE',
  });
  const r = mapVerifyLoginResponse({ ...okJson, status: 'suspended', renewal_url: 'javascript:alert(1)', customer_id: undefined });
  assert.equal(r.status, 'suspended');
  assert.equal(r.customerId, 'ali');
  assert.equal(r.renewalUrl, undefined);
});
