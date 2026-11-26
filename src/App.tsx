/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PreferencesProvider } from './design-system/ThemeContext';
import { AsisClientShell } from './client/AsisClientShell';

export default function App() {
  return (
    <PreferencesProvider>
      <AsisClientShell />
    </PreferencesProvider>
  );
}
