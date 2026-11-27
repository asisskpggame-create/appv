import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Guard: the less-used screens must stay lazily loaded, or the charts library lands back in the first download.
const shell = readFileSync(new URL('../src/client/AsisClientShell.tsx', import.meta.url), 'utf8');

test('shell loads Account, Settings, Statistics, Support and Gateway screens on demand, inside LazyScreen', () => {
  for (const [name, path] of [
    ['AccountView', 'features/account/AccountView'],
    ['SettingsView', 'features/settings'],
    ['StatisticsView', 'features/statistics'],
    ['SupportView', 'features/support/SupportView'],
    ['GatewayStatusView', 'features/gateway/GatewayStatusView'],
  ]) {
    assert.match(shell, new RegExp(`const ${name} = lazy\\(\\(\\) => import\\('\\.\\./${path}'\\)`), `${name} must be lazy`);
    assert.doesNotMatch(shell, new RegExp(`^import \\{[^}]*\\b${name}\\b[^}]*\\} from`, 'm'), `${name} must not be imported statically`);
  }
  assert.match(shell, /<LazyScreen screen=\{screen\}>/);
});
