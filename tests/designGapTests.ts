import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { parseSignupUrl } from '../src/signupLink.ts';
import { planSummary } from '../src/features/subscriptions/planSummary.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const GIB = 1024 ** 3;

test('parseSignupUrl: only plain https links pass', () => {
  assert.equal(parseSignupUrl('https://example.com/start'), 'https://example.com/start');
  assert.equal(parseSignupUrl('  https://example.com  '), 'https://example.com/');
  for (const bad of ['http://example.com', 'javascript:alert(1)', 'https://u:p@example.com', 'not a url', '', '   ', undefined, null, 5]) {
    assert.equal(parseSignupUrl(bad), null, String(bad));
  }
});

test('planSummary: size and days from real data, nothing invented', () => {
  assert.equal(
    planSummary({ totalBytes: 700 * GIB, startsAt: '2026-01-01T00:00:00Z', expiresAt: '2026-06-30T00:00:00Z' }),
    '700 GB | 180 Days',
  );
  assert.equal(planSummary({ totalBytes: 700 * GIB, startsAt: null, expiresAt: null }), '700 GB');
  assert.equal(planSummary({ totalBytes: null, startsAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z' }), '1 Day');
  assert.equal(planSummary({ totalBytes: 0, startsAt: null, expiresAt: null }), null); // unlimited / unknown
  assert.equal(planSummary({ totalBytes: null, startsAt: null, expiresAt: null }), null);
  assert.equal(planSummary({ totalBytes: 1.5 * GIB, startsAt: null, expiresAt: null }), '1.5 GB');
  // end before start or garbage dates: no days part
  assert.equal(planSummary({ totalBytes: 10 * GIB, startsAt: '2026-06-30T00:00:00Z', expiresAt: '2026-01-01T00:00:00Z' }), '10 GB');
  assert.equal(planSummary({ totalBytes: 10 * GIB, startsAt: 'x', expiresAt: 'y' }), '10 GB');
});

test('Home pill says the designed wording', () => {
  const home = read('src/features/home/HomeView.tsx');
  assert.ok(home.includes("return 'متصل هستید';"));
  assert.ok(!home.includes('متصل و ایمن'));
});

test('login: create-account link is behind SIGNUP_URL, opens with noopener, only in password mode', () => {
  const login = read('src/features/auth/LoginScreen.tsx');
  assert.match(login, /mode === 'password' && SIGNUP_URL && \(/);
  assert.match(login, /if \(SIGNUP_URL\) window\.open\(SIGNUP_URL, '_blank', 'noopener,noreferrer'\)/);
  assert.match(login, /ثبت‌نام در حساب کاربری/);
});

test('subscriptions: plan line and the add-a-subscription link are wired', () => {
  const v = read('src/features/subscriptions/SubscriptionsView.tsx');
  assert.match(v, /import \{ planSummary \} from '\.\/planSummary'/);
  assert.match(v, /planSummary\(sub\) &&/);
  assert.match(v, /onClick=\{\(\) => setTab\('imported'\)\}/);
  assert.match(v, /افزودن اشتراک جدید/);
});

test('.env.example documents VITE_SIGNUP_URL', () => {
  assert.match(read('.env.example'), /^VITE_SIGNUP_URL=$/m);
});
