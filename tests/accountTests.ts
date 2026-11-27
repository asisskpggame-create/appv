import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryGatewayStore, type GatewayStore } from '../src/gateway/adapters/gatewayStore.ts';
import { SqliteGatewayStore } from '../src/gateway/adapters/sqliteGatewayStore.ts';
import { MAX_FAILED_LOGINS, authenticateLocalAccount, rejectUnknownUser } from '../src/gateway/localAuth.ts';
import { hashPassword, verifyPassword } from '../src/gateway/passwords.ts';

const LINK = 'https://panel.example.com/sub/AbCdEfGhIjKl';

async function makeStores(): Promise<Array<[string, GatewayStore]>> {
  return [
    ['memory', new InMemoryGatewayStore()],
    ['sqlite', new SqliteGatewayStore(':memory:', { ASIS_DB_KEY: 'k'.repeat(40) })],
  ];
}

async function seed(store: GatewayStore, username = 'ali', password = 'correct-horse') {
  store.saveLocalAccount({ username, passwordHash: await hashPassword(password), subscriptionUrl: LINK });
}

test('passwords: scrypt hash verifies, rejects wrong and malformed hashes, salts differ', async () => {
  const a = await hashPassword('s3cret-pass');
  const b = await hashPassword('s3cret-pass');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('scrypt$'));
  assert.equal(await verifyPassword('s3cret-pass', a), true);
  assert.equal(await verifyPassword('s3cret-pasS', a), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
  assert.equal(await verifyPassword('x', 'scrypt$1$1$1$AA$AA'), false);
});

for (const kind of ['memory', 'sqlite'] as const) {
  test(`lockout (${kind}): 3 wrong passwords lock, the right one no longer works, admin unlock restores`, async () => {
    const store = (await makeStores()).find(([k]) => k === kind)![1];
    await seed(store);

    await assert.rejects(authenticateLocalAccount(store, 'ali', 'wrong-1'), { code: 'AUTH_INVALID_CREDENTIALS' });
    await assert.rejects(authenticateLocalAccount(store, 'ali', 'wrong-2'), { code: 'AUTH_INVALID_CREDENTIALS' });
    // third wrong attempt: locked right away
    await assert.rejects(authenticateLocalAccount(store, 'ALI ', 'wrong-3'), { code: 'AUTH_ACCOUNT_LOCKED', statusCode: 423 });
    // even the correct password is refused while locked
    await assert.rejects(authenticateLocalAccount(store, 'ali', 'correct-horse'), { code: 'AUTH_ACCOUNT_LOCKED' });
    assert.equal(store.getLocalAccount('ali')!.failedAttempts, MAX_FAILED_LOGINS);
    assert.ok(store.getLocalAccount('ali')!.lockedAt);

    assert.equal(store.unlockLocalAccount('ali'), true);
    const ok = await authenticateLocalAccount(store, 'ali', 'correct-horse');
    assert.equal(ok?.subscriptionUrl, LINK);
    assert.equal(store.getLocalAccount('ali')!.failedAttempts, 0);
    assert.ok(store.getLocalAccount('ali')!.lastLoginAt);
  });

  test(`lockout (${kind}): a correct password resets the counter; unlock with a new password swaps it`, async () => {
    const store = (await makeStores()).find(([k]) => k === kind)![1];
    await seed(store);
    await assert.rejects(authenticateLocalAccount(store, 'ali', 'wrong-1'));
    await assert.rejects(authenticateLocalAccount(store, 'ali', 'wrong-2'));
    await authenticateLocalAccount(store, 'ali', 'correct-horse'); // 3rd attempt, correct: allowed
    assert.equal(store.getLocalAccount('ali')!.failedAttempts, 0);

    for (let i = 0; i < 3; i += 1) await assert.rejects(authenticateLocalAccount(store, 'ali', `bad-${i}`));
    assert.equal(store.unlockLocalAccount('ali', await hashPassword('brand-new-pass')), true);
    await assert.rejects(authenticateLocalAccount(store, 'ali', 'correct-horse'), { code: 'AUTH_INVALID_CREDENTIALS' });
    assert.ok(await authenticateLocalAccount(store, 'ali', 'brand-new-pass'));
    assert.equal(store.unlockLocalAccount('nobody'), false);
  });

  test(`lockout (${kind}): parallel guesses never get more than 3 checks`, async () => {
    const store = (await makeStores()).find(([k]) => k === kind)![1];
    await seed(store);
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => authenticateLocalAccount(store, 'ali', `guess-${i}`)),
    );
    const invalid = results.filter((r) => r.status === 'rejected' && (r.reason as { code: string }).code === 'AUTH_INVALID_CREDENTIALS');
    const locked = results.filter((r) => r.status === 'rejected' && (r.reason as { code: string }).code === 'AUTH_ACCOUNT_LOCKED');
    assert.equal(invalid.length, 2);
    assert.equal(locked.length, 10);
    assert.equal(store.getLocalAccount('ali')!.failedAttempts, 3);
  });

  test(`accounts (${kind}): save replaces password and clears the lock; delete; count`, async () => {
    const store = (await makeStores()).find(([k]) => k === kind)![1];
    await seed(store);
    for (let i = 0; i < 3; i += 1) await assert.rejects(authenticateLocalAccount(store, 'ali', `bad-${i}`));
    await seed(store, 'ali', 'another-pass-1');
    assert.equal(store.getLocalAccount('ali')!.failedAttempts, 0);
    assert.ok(await authenticateLocalAccount(store, 'ali', 'another-pass-1'));
    assert.equal(store.countLocalAccounts(), 1);
    assert.equal(await authenticateLocalAccount(store, 'someone-else', 'whatever-1'), null);
    assert.equal(store.deleteLocalAccount('ali'), true);
    assert.equal(store.countLocalAccounts(), 0);
  });
}

test('unknown usernames get the same error as a wrong password', async () => {
  await assert.rejects(rejectUnknownUser('whatever-1'), { code: 'AUTH_INVALID_CREDENTIALS', statusCode: 401 });
});
