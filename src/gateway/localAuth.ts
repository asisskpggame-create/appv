import type { GatewayStore, LocalAccount } from './adapters/gatewayStore.ts';
import { GatewayError } from './errors.ts';
import { verifyAgainstDummy, verifyPassword } from './passwords.ts';

/** Wrong passwords allowed before an account is locked until an admin unlocks it. */
export const MAX_FAILED_LOGINS = 3;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function invalidCredentials(): GatewayError {
  return new GatewayError(
    401,
    'AUTH_INVALID_CREDENTIALS',
    'authentication_failure',
    'Invalid username or password.',
    'verify_credentials',
  );
}

export function lockedError(): GatewayError {
  return new GatewayError(
    423,
    'AUTH_ACCOUNT_LOCKED',
    'authentication_failure',
    'Too many wrong passwords. This account is locked; ask support to unlock it.',
    'contact_support',
  );
}

/**
 * Checks a password against the gateway's own account list.
 *
 * - Every attempt is counted BEFORE the password is checked, in one atomic step, so parallel
 *   requests cannot get more than MAX_FAILED_LOGINS guesses.
 * - A correct password resets the counter; the 3rd wrong one locks the account.
 * - A locked account is rejected without checking the password at all (the right password does
 *   not unlock it). Only an admin can unlock it.
 * - Returns null when the username is not a gateway account (the caller may try another source).
 */
export async function authenticateLocalAccount(
  store: GatewayStore,
  rawUsername: string,
  password: string,
): Promise<LocalAccount | null> {
  const username = normalizeUsername(rawUsername);
  const account = store.getLocalAccount(username);
  if (!account) return null;

  const attempt = store.reserveLoginAttempt(username, MAX_FAILED_LOGINS);
  if (!attempt.allowed) throw lockedError();

  if (!(await verifyPassword(password, account.passwordHash))) {
    throw attempt.attempts >= MAX_FAILED_LOGINS ? lockedError() : invalidCredentials();
  }
  store.recordLoginSuccess(username);
  return account;
}

/** Same cost and same answer as a wrong password, for usernames that do not exist. */
export async function rejectUnknownUser(password: string): Promise<never> {
  await verifyAgainstDummy(password);
  throw invalidCredentials();
}
