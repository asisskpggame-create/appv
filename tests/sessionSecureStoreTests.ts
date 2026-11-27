import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

// Minimal browser-like globals (the module only touches window.Capacitor and window.localStorage).
const local = new Map<string, string>();
const vault = new Map<string, string>();
let vaultFails = false;
const fakePlugin = {
  async get({ key }: { key: string }) {
    if (!vault.has(key)) throw new Error('Item with given key does not exist');
    return { value: vault.get(key)! };
  },
  async set({ key, value }: { key: string; value: string }) {
    if (vaultFails) throw new Error('vault down');
    vault.set(key, value);
    return {};
  },
  async remove({ key }: { key: string }) {
    vault.delete(key);
    return {};
  },
};
const fakeWindow: Record<string, unknown> = {
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k),
  },
  Capacitor: { isNativePlatform: () => true, Plugins: { SecureStoragePlugin: fakePlugin } },
};
(globalThis as unknown as { window: unknown }).window = fakeWindow;

const { loadSessionSecure, persistSessionSecure, getSecureStore, persistSession } = await import(
  '../src/features/auth/sessionStore.ts'
);

const KEY = 'asis_session_v1';
const session = {
  user: { id: 'u1', username: 'alice' },
  tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: 1 },
  deviceId: 'dev_1',
  issuedAt: 1,
} as never;

beforeEach(() => {
  local.clear();
  vault.clear();
  vaultFails = false;
  (fakeWindow as { Capacitor: { Plugins: Record<string, unknown> } }).Capacitor.Plugins.SecureStoragePlugin = fakePlugin;
});

test('secure store: save goes to the vault and not to localStorage', async () => {
  assert.equal(await persistSessionSecure(session), true);
  assert.ok(vault.get(KEY)?.includes('"refreshToken":"r"'));
  assert.equal(local.has(KEY), false);
  const back = await loadSessionSecure();
  assert.equal(back?.deviceId, 'dev_1');
});

test('secure store: an old localStorage session is moved into the vault once', async () => {
  persistSession(session); // old behaviour writes localStorage
  assert.equal(local.has(KEY), true);
  const loaded = await loadSessionSecure();
  assert.equal(loaded?.user.id, 'u1');
  assert.equal(vault.has(KEY), true);
  assert.equal(local.has(KEY), false);
});

test('secure store: clearing removes the vault and localStorage copies', async () => {
  await persistSessionSecure(session);
  local.set(KEY, 'stale');
  assert.equal(await persistSessionSecure(null), true);
  assert.equal(vault.has(KEY), false);
  assert.equal(local.has(KEY), false);
  assert.equal(await loadSessionSecure(), null);
});

test('secure store: vault write failure falls back to localStorage (person stays signed in)', async () => {
  vaultFails = true;
  assert.equal(await persistSessionSecure(session), false);
  assert.equal(local.has(KEY), true);
  assert.equal((await loadSessionSecure())?.user.id, 'u1'); // migration write fails too, local copy kept
  assert.equal(local.has(KEY), true);
});

test('secure store: garbage in the vault is ignored', async () => {
  vault.set(KEY, '{not json');
  assert.equal(await loadSessionSecure(), null);
});

test('no plugin installed: behaves exactly like the old localStorage storage', async () => {
  delete (fakeWindow as { Capacitor: { Plugins: Record<string, unknown> } }).Capacitor.Plugins.SecureStoragePlugin;
  assert.equal(getSecureStore(), null);
  assert.equal(await persistSessionSecure(session), false);
  assert.equal(local.has(KEY), true);
  assert.equal((await loadSessionSecure())?.deviceId, 'dev_1');
  await persistSessionSecure(null);
  assert.equal(local.has(KEY), false);
});

test('browser (not the installed app): nothing is persisted at all', async () => {
  (fakeWindow as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform = () => false;
  assert.equal(getSecureStore(), null);
  assert.equal(await persistSessionSecure(session), false);
  assert.equal(local.has(KEY), false);
  assert.equal(await loadSessionSecure(), null);
  (fakeWindow as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform = () => true;
});
