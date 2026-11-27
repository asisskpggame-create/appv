import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Source guard (no DOM test setup in this repo): the shell must keep the safe order for the
// async secure-store restore. If someone "simplifies" it back, these fail.
const src = readFileSync(new URL('../src/client/AsisClientShell.tsx', import.meta.url), 'utf8');

test('shell restores the session through loadSessionSecure and saves through persistSessionSecure', () => {
  assert.match(src, /loadSessionSecure\(\)/);
  assert.match(src, /persistSessionSecure\(authSession\)/);
  assert.equal(/[^e]persistSession\(authSession\)/.test(src), false, 'old direct persistSession call is back');
});

test('shell never saves while restoring (would wipe the stored session)', () => {
  const effect = src.slice(src.indexOf('persistSessionSecure(authSession)') - 120, src.indexOf('persistSessionSecure(authSession)'));
  assert.match(effect, /if \(sessionRestoring\) return;/);
});

test('shell waits for the restore before the launch token refresh and before showing sign-in', () => {
  const refreshAt = src.indexOf("new HttpAuthClient('/api/v1')");
  assert.ok(refreshAt > 0);
  assert.match(src.slice(refreshAt - 400, refreshAt), /if \(sessionRestoring\) return;/);
  const restoringGate = src.indexOf('if (sessionRestoring) {');
  const loginGate = src.indexOf('if (!authSession && !guestMode) {');
  assert.ok(restoringGate > 0 && loginGate > restoringGate, 'restoring screen must come before the sign-in gate');
});
