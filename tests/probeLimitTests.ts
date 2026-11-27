import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(
  new URL('../native/android/src/com/asisvpn/client/vpn/AsisVpnPlugin.java', import.meta.url),
  'utf8',
);

test('tcpProbe has an overall deadline constant', () => {
  assert.match(src, /PROBE_OVERALL_MS\s*=\s*\d+/);
});

test('tcpProbe waits on each result with a timeout, not a bare get()', () => {
  assert.match(src, /f\.get\(left,\s*TimeUnit\.NANOSECONDS\)/);
  assert.doesNotMatch(src, /results\.put\(f\.get\(\)\)/);
});

test('unfinished targets come back as a timeout result', () => {
  assert.match(src, /catch \(TimeoutException/);
  assert.match(src, /"error",\s*"timeout"/);
  assert.match(src, /f\.cancel\(true\)/);
});
