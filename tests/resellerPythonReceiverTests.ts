import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import test, { after, before } from 'node:test';
import { HttpResellerAdapter } from '../src/gateway/adapters/resellerAdapter.ts';

// Cross-language check: the real gateway adapter against the Python reference receiver
// (reference/verify-login-receiver/receiver.py). Skipped when python3 is not installed.
const KEY = 'k'.repeat(40);
const PORT = 18_000 + Math.floor(Math.random() * 1000);
const hasPython = spawnSync('python3', ['--version']).status === 0;
let child: ChildProcess | undefined;

before(async () => {
  if (!hasPython) return;
  child = spawn('python3', ['reference/verify-login-receiver/receiver.py', '--port', String(PORT), '--key', KEY], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('python receiver did not start')), 8000);
    child!.stdout!.on('data', (d) => {
      if (String(d).includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child!.on('exit', (code) => reject(new Error(`python receiver exited early (${code})`)));
  });
});
after(() => {
  child?.removeAllListeners('exit');
  child?.kill();
});

const adapter = (key = KEY) => new HttpResellerAdapter(`http://127.0.0.1:${PORT}/asis`, key);

test('python receiver: good login, suspended, wrong password, unknown user, wrong key', { skip: !hasPython && 'python3 not installed' }, async () => {
  const c = await adapter().authenticateEndUser('Ali', 'correct-horse');
  assert.deepEqual([c.username, c.customerId, c.status, c.allowedDevices], ['ali', '42', 'active', 3]);
  assert.equal(c.subscriptionUrl, 'https://panel.example.com/sub/AbCdEfGhIjKl');
  assert.equal((await adapter().authenticateEndUser('sus', 'correct-horse')).status, 'suspended');
  await assert.rejects(adapter().authenticateEndUser('ali', 'wrong-pass-1'), { code: 'AUTH_INVALID_CREDENTIALS' });
  await assert.rejects(adapter().authenticateEndUser('ghost', 'wrong-pass-1'), { code: 'AUTH_INVALID_CREDENTIALS' });
  await assert.rejects(adapter('x'.repeat(40)).authenticateEndUser('ali', 'correct-horse'), { code: 'AUTH_INVALID_CREDENTIALS' });
});

test('python receiver: 5 wrong passwords for one name (even an unknown one) -> AUTH_RATE_LIMITED', { skip: !hasPython && 'python3 not installed' }, async () => {
  for (let i = 0; i < 5; i += 1) await assert.rejects(adapter().authenticateEndUser('carol', `wrong-pass-${i}`), { code: 'AUTH_INVALID_CREDENTIALS' });
  await assert.rejects(adapter().authenticateEndUser('carol', 'correct-horse'), { code: 'AUTH_RATE_LIMITED' });
});

test('python receiver: the same login twice in the same second works (nonce)', { skip: !hasPython && 'python3 not installed' }, async () => {
  assert.equal((await adapter().authenticateEndUser('ali', 'correct-horse')).username, 'ali');
  assert.equal((await adapter().authenticateEndUser('ali', 'correct-horse')).username, 'ali');
});
