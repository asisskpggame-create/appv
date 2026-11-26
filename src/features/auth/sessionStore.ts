import type { AuthSession, SessionStorageAdapter } from './types';

/**
 * Web preview memory-only session adapter.
 * Tokens are intentionally NEVER persisted to localStorage or sessionStorage.
 * Native targets implement SessionStorageAdapter using:
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
