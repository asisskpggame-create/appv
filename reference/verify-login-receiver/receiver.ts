/**
 * REFERENCE receiver for the ASiS gateway's `POST /verify-login` (contract: RESELLER_INTEGRATION.md,
 * section 0). It is NOT the owner's sales bot: copy the idea into the bot and plug the bot's own
 * customer database into `lookup`. Depends only on node:crypto, so it can be copied as is.
 *
 * What it enforces:
 *  - HMAC-SHA256 over `${timestamp}.${raw body}` with the shared key, compared in constant time;
 *  - timestamp within +/-60 s, and a signature can be used once inside that window (replay);
 *  - at most 5 failed passwords per username per 15 min (then 429, no password check at all);
 *  - wrong password and unknown username are the same 401 and cost about the same time.
 * Always put it behind HTTPS (the body carries the password).
 */
import crypto from 'node:crypto';

export interface CustomerRecord {
  customerId: string;
  username: string;
  status: 'active' | 'suspended';
  subscriptionUrl: string;
  allowedDevices?: number | null;
  renewalUrl?: string;
  /** Opaque value the bot stores for the customer's app password (argon2/bcrypt/scrypt hash...). */
  passwordHash: string;
}

export interface VerifyLoginDeps {
  apiKey: string;
  /** Finds a customer by the (lower-cased) username, or null. */
  lookup(username: string): Promise<CustomerRecord | null>;
  /** Checks a password against the bot's stored hash. Must be constant-time. */
  verifyPassword(password: string, passwordHash: string): Promise<boolean>;
  /** Burns the same time as a real check (used for unknown usernames). */
  burnPasswordCheck(password: string): Promise<void>;
  now?: () => number;
  maxClockSkewSeconds?: number;
  maxFailures?: number;
  failureWindowMs?: number;
}

export interface ReceiverResponse {
  status: number;
  body: Record<string, unknown>;
}

export function signature(apiKey: string, timestamp: string, rawBody: string): string {
  return crypto.createHmac('sha256', apiKey).update(`${timestamp}.${rawBody}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

export function createVerifyLoginHandler(deps: VerifyLoginDeps) {
  const now = deps.now ?? (() => Date.now());
  const skew = deps.maxClockSkewSeconds ?? 60;
  const maxFailures = deps.maxFailures ?? 5;
  const windowMs = deps.failureWindowMs ?? 15 * 60_000;
  const failures = new Map<string, { count: number; first: number }>();
  const usedSignatures = new Map<string, number>();

  const failuresFor = (username: string) => {
    const entry = failures.get(username);
    if (!entry || now() - entry.first > windowMs) {
      failures.delete(username);
      return 0;
    }
    return entry.count;
  };
  const recordFailure = (username: string) => {
    const entry = failures.get(username);
    if (!entry || now() - entry.first > windowMs) failures.set(username, { count: 1, first: now() });
    else entry.count += 1;
  };

  return async function handle(headers: Record<string, string | undefined>, rawBody: string): Promise<ReceiverResponse> {
    const unauthorized: ReceiverResponse = { status: 401, body: { ok: false } };

    // 1) Authenticate the caller before touching the body.
    const timestamp = headers['x-asis-timestamp'] ?? '';
    const provided = headers['x-asis-signature'] ?? '';
    if (!/^\d{9,12}$/.test(timestamp) || !provided) return unauthorized;
    if (Math.abs(now() / 1000 - Number(timestamp)) > skew) return unauthorized;
    if (!safeEqualHex(provided, signature(deps.apiKey, timestamp, rawBody))) return unauthorized;

    // Replay: the same signed request cannot be used twice inside the window.
    for (const [sig, at] of usedSignatures) if (now() - at > skew * 2000) usedSignatures.delete(sig);
    if (usedSignatures.has(provided)) return unauthorized;
    usedSignatures.set(provided, now());

    // 2) Parse.
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { status: 400, body: { ok: false } };
    }
    const o = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    const username = typeof o.username === 'string' ? o.username.trim().toLowerCase() : '';
    const password = typeof o.password === 'string' ? o.password : '';
    if (!username || username.length > 64 || !password || password.length > 128) return unauthorized;

    // 3) Throttle per username before any password work.
    if (failuresFor(username) >= maxFailures) return { status: 429, body: { ok: false } };

    // 4) Check. Unknown user and wrong password look the same.
    const customer = await deps.lookup(username);
    if (!customer) {
      await deps.burnPasswordCheck(password);
      recordFailure(username);
      return unauthorized;
    }
    if (!(await deps.verifyPassword(password, customer.passwordHash))) {
      recordFailure(username);
      return unauthorized;
    }
    failures.delete(username);

    return {
      status: 200,
      body: {
        ok: true,
        customer_id: customer.customerId,
        username: customer.username,
        status: customer.status,
        subscription_url: customer.subscriptionUrl,
        ...(customer.allowedDevices ? { allowed_devices: customer.allowedDevices } : {}),
        ...(customer.renewalUrl ? { renewal_url: customer.renewalUrl } : {}),
      },
    };
  };
}
