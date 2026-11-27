import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const svc = readFileSync(
  new URL('../native/android/src/com/asisvpn/client/vpn/AsisVpnService.java', import.meta.url),
  'utf8',
);
const patch = readFileSync(new URL('../native/android/scripts/patch_android.py', import.meta.url), 'utf8');

test('service goes foreground on START and a refusal is not fatal', () => {
  assert.match(svc, /ACTION_START\.equals\(action\)\)\s*\{\s*enterForeground\(false\)/);
  const fn = svc.slice(svc.indexOf('private void enterForeground'));
  assert.match(fn.slice(0, 400), /try\s*\{[\s\S]*startForeground[\s\S]*catch \(RuntimeException/);
});

test('notification leaves on stop, failure and destroy', () => {
  const n = (svc.match(/leaveForeground\(\);/g) || []).length;
  assert.ok(n >= 5, `expected leaveForeground in stopAndExit, 3 failure paths and onDestroy, got ${n}`);
});

test('notification has a Disconnect action and an immutable PendingIntent', () => {
  assert.match(svc, /ACTION_STOP/);
  assert.match(svc, /FLAG_IMMUTABLE/);
  assert.match(svc, /NotificationChannel/);
});

test('manifest patch adds the permissions and the service type', () => {
  assert.match(patch, /FOREGROUND_SERVICE"/);
  assert.match(patch, /FOREGROUND_SERVICE_SYSTEM_EXEMPTED/);
  assert.match(patch, /foregroundServiceType="systemExempted"/);
});

const plugin = readFileSync(
  new URL('../native/android/src/com/asisvpn/client/vpn/AsisVpnPlugin.java', import.meta.url),
  'utf8',
);

test('notification permission is asked once, after connect, and never blocks the connect', () => {
  assert.match(patch, /POST_NOTIFICATIONS/);
  // asked only after call.resolve() on success
  assert.match(plugin, /call\.resolve\(\);\s*askNotificationPermissionOnce\(\);/);
  const fn = plugin.slice(plugin.indexOf('private void askNotificationPermissionOnce'));
  const body = fn.slice(0, fn.indexOf('private void sendStop'));
  assert.match(body, /SDK_INT < 33\) return/);
  assert.match(body, /PERMISSION_GRANTED\) return/);
  assert.match(body, /PREF_NOTIF_ASKED, false\)\) return/);
  assert.match(body, /putBoolean\(PREF_NOTIF_ASKED, true\)/);
  assert.doesNotMatch(body, /call\.reject/);
});

test('brand status icon: used by the service, shipped per density, installed by the script', async () => {
  const { existsSync, readFileSync: rf } = await import('node:fs');
  assert.match(svc, /getIdentifier\("ic_stat_asis", "drawable"/);
  assert.match(svc, /setSmallIcon\(statusIcon\(\)\)/);
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const f = new URL(`../native/android/res/drawable-${d}/ic_stat_asis.png`, import.meta.url);
    assert.ok(existsSync(f), `missing ${d} icon`);
    assert.equal(rf(f).subarray(1, 4).toString(), 'PNG');
  }
  const install = rf(new URL('../native/android/scripts/install-native.sh', import.meta.url), 'utf8');
  assert.match(install, /cp -r "\$SRC\/res\/\." android\/app\/src\/main\/res\//);
});
