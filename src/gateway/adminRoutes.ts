import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { GatewayStore } from './adapters/gatewayStore.ts';
import type { PasarGuardAdapterRegistry } from './adapters/pasarguardAdapter.ts';
import { GatewayError } from './errors.ts';
import { MAX_FAILED_LOGINS, normalizeUsername } from './localAuth.ts';
import { hashPassword } from './passwords.ts';
import { createRateLimiter } from './security.ts';

const USERNAME_RE = /^[a-z0-9._-]{3,64}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

function bad(message: string): GatewayError {
  return new GatewayError(400, 'ADMIN_VALIDATION_FAILED', 'validation_error', message, 'verify_credentials');
}

function digest(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

/** Constant-time comparison of two secrets of any length. */
export function adminKeyMatches(provided: string, expected: string): boolean {
  return crypto.timingSafeEqual(digest(provided), digest(expected));
}

function accountView(a: NonNullable<ReturnType<GatewayStore['getLocalAccount']>>) {
  return {
    username: a.username,
    locked: a.failedAttempts >= MAX_FAILED_LOGINS,
    failedAttempts: a.failedAttempts,
    lockedAt: a.lockedAt,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function checkPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD || value.length > MAX_PASSWORD) {
    throw bad(`Password must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters.`);
  }
  return value;
}

function parseUsername(raw: unknown): string {
  const username = typeof raw === 'string' ? normalizeUsername(raw) : '';
  if (!USERNAME_RE.test(username)) throw bad('Username must be 3-64 characters: a-z, 0-9, dot, dash, underscore.');
  return username;
}

/**
 * Operator-only endpoints to manage gateway-held accounts and to unlock them after the 3-strike
 * lock. Disabled (404) unless ADMIN_API_KEY (>= 32 chars) is set; the key goes in `X-Admin-Key`.
 * Never expose this path publicly: put it behind the reverse proxy's allowlist or a VPN.
 */
export function createAdminRouter(deps: { store: GatewayStore; pasarguard: PasarGuardAdapterRegistry }) {
  const router = express.Router();
  const adminRateLimit = createRateLimiter('admin', 30, 60_000);

  router.use((req: Request, _res: Response, next: NextFunction) => {
    const expected = process.env.ADMIN_API_KEY?.trim() ?? '';
    if (expected.length < 32) {
      return next(new GatewayError(404, 'NOT_FOUND', 'validation_error', 'Not found.'));
    }
    adminRateLimit(req, _res, (limited?: unknown) => {
      if (limited) return next(limited);
      const provided = typeof req.headers['x-admin-key'] === 'string' ? req.headers['x-admin-key'] : '';
      if (!provided || !adminKeyMatches(provided, expected)) {
        return next(
          new GatewayError(401, 'ADMIN_AUTH_FAILED', 'authentication_failure', 'Invalid admin key.', 'verify_credentials'),
        );
      }
      next();
    });
  });

  // Create an account, or set a new password / link for an existing one (also clears a lock).
  router.put('/accounts/:username', async (req, res, next) => {
    try {
      const username = parseUsername(req.params.username);
      const password = checkPassword(req.body?.password);
      const link = typeof req.body?.subscriptionUrl === 'string' ? req.body.subscriptionUrl.trim() : '';
      if (!link || link.length > 2048) throw bad('subscriptionUrl is required.');
      if (!deps.pasarguard.findForLink(link)) {
        throw bad('subscriptionUrl does not belong to a configured PasarGuard instance.');
      }
      const existed = Boolean(deps.store.getLocalAccount(username));
      deps.store.saveLocalAccount({ username, passwordHash: await hashPassword(password), subscriptionUrl: link });
      console.info(`[admin] account ${existed ? 'updated' : 'created'}: ${username}`);
      res.status(existed ? 200 : 201).json(accountView(deps.store.getLocalAccount(username)!));
    } catch (err) {
      next(err);
    }
  });

  router.get('/accounts/:username', (req, res, next) => {
    try {
      const account = deps.store.getLocalAccount(parseUsername(req.params.username));
      if (!account) throw new GatewayError(404, 'ACCOUNT_NOT_FOUND', 'validation_error', 'No such account.');
      res.json(accountView(account));
    } catch (err) {
      next(err);
    }
  });

  // The "user asked the admin for help" path: clears the lock, optionally sets a new password.
  router.post('/accounts/:username/unlock', async (req, res, next) => {
    try {
      const username = parseUsername(req.params.username);
      const newPasswordHash =
        req.body?.newPassword === undefined ? undefined : await hashPassword(checkPassword(req.body.newPassword));
      if (!deps.store.unlockLocalAccount(username, newPasswordHash)) {
        throw new GatewayError(404, 'ACCOUNT_NOT_FOUND', 'validation_error', 'No such account.');
      }
      console.info(`[admin] account unlocked: ${username}${newPasswordHash ? ' (password changed)' : ''}`);
      res.json(accountView(deps.store.getLocalAccount(username)!));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/accounts/:username', (req, res, next) => {
    try {
      const username = parseUsername(req.params.username);
      if (!deps.store.deleteLocalAccount(username)) {
        throw new GatewayError(404, 'ACCOUNT_NOT_FOUND', 'validation_error', 'No such account.');
      }
      console.info(`[admin] account deleted: ${username}`);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
