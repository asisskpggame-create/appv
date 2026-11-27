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
  assert.match(login, /ساخت حساب کاربری/);
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

test('statistics: download/upload pair plus a separate big total card', () => {
  const v = read('src/features/statistics/StatisticsView.tsx');
  assert.match(v, /data-testid="stats-summary-cards"/);
  assert.match(v, /grid grid-cols-2 gap-2" data-testid="stats-summary-cards"/);
  assert.match(v, /data-testid="stats-total-card"/);
  assert.ok(!v.includes('grid-cols-3 gap-2" data-testid="stats-summary-cards"'));
});

test('Power button: glowing orb, state carried by color (green connected, red error) through CSS', () => {
  const b = read('src/features/home/ConnectionButton.tsx');
  assert.ok(b.includes('43, 182, 115')); // connected green (rgb for the orb glow)
  assert.ok(b.includes('214, 69, 69')); // error red
  assert.ok(b.includes('asis-orb'));
  assert.ok(b.includes('asis-dot-ring'));
  const css = read('src/index.css');
  assert.match(css, /\.asis-orb\[data-state="connected"\]/);
  assert.match(css, /\.asis-orb\[data-state="error"\]/);
  assert.match(css, /\.asis-halo \{ animation: none/); // reduced motion respected
});

test('settings: advanced controls are a separate sub-page with a back button, not an in-place toggle', () => {
  const v = read('src/features/settings/SettingsView.tsx');
  assert.match(v, /if \(showAdvanced\) return advancedPage;/);
  assert.match(v, /onClick=\{\(\) => setShowAdvanced\(true\)\}/);
  assert.match(v, /onClick=\{\(\) => setShowAdvanced\(false\)\}/);
  assert.ok(!v.includes("showAdvanced ? '' : 'hidden'"));
  // split tunneling + advanced cards live only inside the sub-page
  const main = v.slice(v.indexOf('  return (\n    <div className="space-y-5 text-start md:space-y-8">'));
  assert.ok(!main.includes('Advanced Connection Settings'));
  assert.ok(!main.includes('Split Tunneling & App Selection'));
  assert.match(read('src/index.css'), /@media \(hover: none\)[^{]*\{\s*button:not\(:disabled\):active/);
});

test('bottom tab marks the active page and server rows have hover feedback', () => {
  const shell = read('src/client/AsisClientShell.tsx');
  assert.match(shell, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(shell, /bg-\[var\(--asis-primary-soft\)\]/);
  assert.match(read('src/index.css'), /@keyframes asis-tab-in/);
  const servers = read('src/features/servers/ServersView.tsx');
  assert.match(servers, /hover:border-\[var\(--asis-border-strong\)\]/);
  assert.match(servers, /active:scale-\[0\.985\]/);
});

test('statistics: technical usage block is a collapsed <details> after the chart; subscriptions tab bar only when needed', () => {
  const st = read('src/features/statistics/StatisticsView.tsx');
  const chart = st.indexOf('Visual Traffic Usage History');
  const details = st.indexOf('<details className="asis-details');
  const authoritative = st.indexOf('Authoritative Subscription Usage');
  assert.ok(chart > 0 && details > chart, 'details comes after the chart');
  assert.ok(authoritative > details, 'server usage card lives inside the details');
  assert.ok(!st.includes('<details className="asis-details group rounded-2xl border border-[var(--asis-border)] bg-[var(--asis-surface)]/60" open'));
  const sub = read('src/features/subscriptions/SubscriptionsView.tsx');
  assert.match(sub, /\(accountSubscriptions\.length > 0 \|\| tab === 'account'\) && \(/);
});

test('redesign: login has no skyline, settings are grouped, auto-reconnect label stays distinct', () => {
  const login = read('src/features/auth/LoginScreen.tsx');
  assert.ok(!login.includes('Skyline'));
  assert.ok(login.includes('asis-glass')); // glass sheet via shared CSS class, no inline blur utilities
  assert.ok(!login.includes('blur-'));
  assert.ok(login.includes('rounded-t-\[28px\]'));
  const settings = read('src/features/settings/SettingsView.tsx');
  assert.ok(settings.includes("'اتصال مجدد خودکار'"));
  assert.ok(settings.includes("'اتصال هنگام باز شدن برنامه'"));
  const auth = read('src/features/auth/AuthForm.tsx');
  assert.match(auth, /<details className="asis-details group text-start">/);
  assert.ok(!auth.includes('h-28 w-28 items-center justify-center rounded-full border'));
});

test('servers (phone): search pill and quick filter chips (all / fast / favorites)', () => {
  const v = read('src/features/servers/ServersView.tsx');
  assert.ok(v.includes("handleQuickFilter(id)"));
  assert.match(v, /id: 'fast'/);
  assert.match(v, /setSortMode\(id === 'fast' \? 'latency' : 'default'\)/);
  assert.match(read('src/index.css'), /\.asis-search:focus-within/);
});

test('home: fastest-server card uses measured latency only and is wired through the shell', () => {
  const h = read('src/features/home/HomeView.tsx');
  assert.match(h, /find\(\(c\) => c\.probeLatencyMs !== null\)/);
  assert.ok(h.includes('showFastestCard'));
  const shell = read('src/client/AsisClientShell.tsx');
  assert.ok(shell.includes('onSelectServer={(srv) => {\n                  setAutoConnectPending(false);\n                  setSelectedServer(srv);\n                }}'));
});

test('subscriptions: gradient quota ring, plan pill, days-left bar only from real dates', () => {
  const ring = read('src/design-system/components/QuotaRing.tsx');
  assert.ok(ring.includes('linearGradient'));
  const v = read('src/features/subscriptions/SubscriptionsView.tsx');
  assert.ok(v.includes('function planDays'));
  assert.match(v, /if \(!sub\.startsAt \|\| !sub\.expiresAt\) return null/);
  assert.ok(v.includes('role="progressbar"'));
});

test('shared look: pill segmented control, glass dialog, glass stats tiles', () => {
  assert.ok(read('src/design-system/components/SegmentedControl.tsx').includes('rounded-full'));
  assert.ok(read('src/design-system/components/Dialog.tsx').includes('asis-glass'));
  const st = read('src/features/statistics/StatisticsView.tsx');
  assert.ok(st.includes('asis-glass rounded-3xl p-4 text-center'));
});
