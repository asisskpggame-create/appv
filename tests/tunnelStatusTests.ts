import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(
  new URL('../native/android/src/com/asisvpn/client/vpn/AsisVpnPlugin.java', import.meta.url),
  'utf8',
);
const fn = (name: string) => {
  const i = src.indexOf(name);
  assert.ok(i >= 0, `${name} missing`);
  const rest = src.slice(i);
  const next = rest.slice(10).search(/\n    (private|public|@PluginMethod)/);
  return rest.slice(0, next < 0 ? rest.length : next + 10);
};

test('readTunnelStatus asks the controller once (/proxies), not once per server', () => {
  const body = fn('private static JSObject readTunnelStatus()');
  assert.match(body, /controllerGet\("\/proxies", 3000\)/);
  assert.doesNotMatch(body, /for \(/);
  assert.match(body, /readTunnelStatusOneByOne\(\)/);
});

test('the one-by-one fallback has a total time limit and marks late tags unknown', () => {
  const body = fn('private static JSObject readTunnelStatusOneByOne()');
  assert.match(src, /STATUS_FALLBACK_MS\s*=\s*\d+/);
  assert.match(body, /System\.currentTimeMillis\(\) >= deadline/);
  assert.match(body, /delays\.put\(tag, JSONObject\.NULL\)/);
});

test('status result keeps the shape the JS side reads (available, active, delays)', () => {
  const body = fn('private static JSObject statusFrom(');
  for (const k of ['"delays"', '"available"', '"active"']) assert.ok(body.includes(k), k);
  assert.match(body, /\[A-Za-z0-9_-\]\{1,64\}/); // tag whitelist kept
});
