import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

type Deferred = { resolve: () => void; reject: (e: Error) => void };
const calls: string[] = [];
const pending: Deferred[] = [];
let running = 0;
let maxRunning = 0;

const fakeWindow: Record<string, unknown> = {
  AsisNativeBridge: {
    platform: 'android',
    connect(outboundJson: string) {
      calls.push(outboundJson);
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      return new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            running -= 1;
            resolve();
          },
          reject: (e) => {
            running -= 1;
            reject(e);
          },
        });
      });
    },
    async disconnect() {},
    async getState() {
      return 'Connected';
    },
    async getStats() {
      return { sessionDurationSec: 0 };
    },
  },
};
(globalThis as unknown as { window: unknown }).window = fakeWindow;

const { AsisVpnEngineAdapter } = await import('../src/engine/webEngineAdapter.ts');

const a = { singBoxOutbound: { tag: 'a' } } as never;
const b = { singBoxOutbound: { tag: 'b' } } as never;
const policy = {} as never;
const tick = () => new Promise<void>((r) => setTimeout(r, 5));

beforeEach(() => {
  calls.length = 0;
  pending.length = 0;
  running = 0;
  maxRunning = 0;
});

test('same connect twice at once: one native connect, both callers get the result', async () => {
  const eng = new AsisVpnEngineAdapter('android');
  const p1 = eng.connect(a, policy);
  const p2 = eng.connect(a, policy);
  await tick();
  assert.equal(calls.length, 1);
  pending[0].resolve();
  await Promise.all([p1, p2]);
  assert.equal(eng.getConnectionState(), 'Connected');
});

test('different connects at once: they run one after the other, never together', async () => {
  const eng = new AsisVpnEngineAdapter('android');
  const p1 = eng.connect(a, policy);
  const p2 = eng.connect(b, policy);
  await tick();
  assert.equal(calls.length, 1, 'second must wait');
  pending[0].resolve();
  await p1;
  await tick();
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('"a"') && calls[1].includes('"b"'));
  pending[1].resolve();
  await p2;
  assert.equal(maxRunning, 1);
});

test('a failed connect does not block the next one', async () => {
  const eng = new AsisVpnEngineAdapter('android');
  const p1 = eng.connect(a, policy);
  const p2 = eng.connect(b, policy);
  await tick();
  pending[0].reject(Object.assign(new Error('boom'), { code: 'ENGINE_CONNECT_TIMEOUT' }));
  await assert.rejects(p1, (e: { code?: string }) => e.code === 'ENGINE_CONNECT_TIMEOUT');
  await tick();
  assert.equal(calls.length, 2);
  pending[1].resolve();
  await p2;
});

test('after a connect finished, the same request connects again (no caching)', async () => {
  const eng = new AsisVpnEngineAdapter('android');
  const p1 = eng.connect(a, policy);
  await tick();
  pending[0].resolve();
  await p1;
  const p2 = eng.connect(a, policy);
  await tick();
  assert.equal(calls.length, 2);
  pending[1].resolve();
  await p2;
});
