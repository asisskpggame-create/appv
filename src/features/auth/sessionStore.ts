import type { AuthSession, SessionStorageAdapter } from './types';

/**
 * Web preview memory-only session adapter: in a browser, tokens are never persisted to localStorage or sessionStorage.
 * NOTE: the installed app (see persistSession below) currently keeps the session in the WebView's localStorage,
 * NOT in the system secure store. Moving it there is still open (see CHANGELOG 0.4.17).
 * Native targets should implement SessionStorageAdapter using:
 *  - Android: Keystore + EncryptedSharedPreferences
 *  - iOS: Keychain Services (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
 *  - Windows: DPAPI / Windows Credential Manager
 */
export class InMemorySessionStorage implements SessionStorageAdapter {
  private currentSession: AuthSession | null = null;

  async readSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  async writeSession(session: AuthSession): Promise<void> {
    this.currentSession = session;
  }

  async clearSession(): Promise<void> {
    this.currentSession = null;
  }
}

export function isAccessTokenExpiringSoon(session: AuthSession, skewMs = 60_000): boolean {
  return Date.now() + skewMs >= session.tokens.expiresAt;
}

export function getOrCreateWebDeviceId(): string {
  // Ephemeral per-tab device identifier; no PII or persistent tracking.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web_${crypto.randomUUID()}`;
  }
  return `web_${Math.random().toString(36).slice(2, 12)}`;
}

const PERSIST_SESSION_KEY = 'asis_session_v1';
const PERSIST_DEVICE_KEY = 'asis_device_id_v1';

/** True only inside the installed Android/iOS app (Capacitor shell). */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** Stable per-install device id inside the native app; per-tab id in a browser. */
export function getStableDeviceId(): string {
  if (!isNativeApp()) return getOrCreateWebDeviceId();
  try {
    const stored = window.localStorage.getItem(PERSIST_DEVICE_KEY);
    if (stored) return stored;
    const created =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `app_${crypto.randomUUID()}`
        : `app_${Math.random().toString(36).slice(2, 14)}`;
    window.localStorage.setItem(PERSIST_DEVICE_KEY, created);
    return created;
  } catch {
    return getOrCreateWebDeviceId();
  }
}

/** The installed app keeps the user signed in; the browser preview never persists tokens. */
export function loadPersistedSession(): AuthSession | null {
  if (!isNativeApp()) return null;
  try {
    const raw = window.localStorage.getItem(PERSIST_SESSION_KEY);
    if (!raw) return null;
    return parseStoredSession(raw);
  } catch {
    return null;
  }
}

function parseStoredSession(raw: string): AuthSession | null {
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.user?.id || !parsed?.tokens?.refreshToken || !parsed?.deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistSession(session: AuthSession | null): void {
  if (!isNativeApp()) return;
  try {
    if (session) window.localStorage.setItem(PERSIST_SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(PERSIST_SESSION_KEY);
  } catch {
    // Ignore storage errors.
  }
}

// ---------------------------------------------------------------------------
// System secure store (Android Keystore / iOS Keychain) - OPTIONAL, used only when a
// secure-storage Capacitor plugin is installed in the app. Without it everything above keeps
// working exactly as before (WebView localStorage). Not wired into the UI yet (next step).
// The plugin is read from `window.Capacitor.Plugins.SecureStoragePlugin` (the API of
// `capacitor-secure-storage-plugin`: get/set/remove with `{ key, value }`), so no import is needed.
// ---------------------------------------------------------------------------

export interface SecureStoreLike {
  get(options: { key: string }): Promise<{ value: string }>;
  set(options: { key: string; value: string }): Promise<unknown>;
  remove(options: { key: string }): Promise<unknown>;
}

/** The secure store, or null in a browser / when the plugin is not installed. */
export function getSecureStore(): SecureStoreLike | null {
  if (!isNativeApp()) return null;
  const plugins = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor?.Plugins;
  const plugin = plugins?.SecureStoragePlugin as Partial<SecureStoreLike> | undefined;
  if (plugin && typeof plugin.get === 'function' && typeof plugin.set === 'function' && typeof plugin.remove === 'function') {
    return plugin as SecureStoreLike;
  }
  return null;
}

function removeLegacySession(): void {
  try {
    window.localStorage.removeItem(PERSIST_SESSION_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Loads the saved session. With a secure store: reads it from there, and moves an old
 * localStorage session into it once (then deletes the localStorage copy). Without one: same as
 * `loadPersistedSession()`.
 */
export async function loadSessionSecure(): Promise<AuthSession | null> {
  const store = getSecureStore();
  if (!store) return loadPersistedSession();
  try {
    const { value } = await store.get({ key: PERSIST_SESSION_KEY });
    const fromVault = typeof value === 'string' ? parseStoredSession(value) : null;
    if (fromVault) {
      removeLegacySession();
      return fromVault;
    }
  } catch {
    // The plugin throws when the key does not exist yet: fall through to the migration.
  }
  const legacy = loadPersistedSession();
  if (!legacy) return null;
  try {
    await store.set({ key: PERSIST_SESSION_KEY, value: JSON.stringify(legacy) });
    removeLegacySession();
  } catch {
    // Keep the localStorage copy if the vault write failed, so the person stays signed in.
  }
  return legacy;
}

/** Saves (or clears, with null) the session. Returns true when the secure store was used. */
export async function persistSessionSecure(session: AuthSession | null): Promise<boolean> {
  const store = getSecureStore();
  if (!store) {
    persistSession(session);
    return false;
  }
  try {
    if (session) await store.set({ key: PERSIST_SESSION_KEY, value: JSON.stringify(session) });
    else await store.remove({ key: PERSIST_SESSION_KEY }).catch(() => undefined);
    removeLegacySession();
    return true;
  } catch {
    // Vault write failed: fall back to the old storage rather than losing the session.
    persistSession(session);
    return false;
  }
}
