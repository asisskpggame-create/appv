import crypto from 'node:crypto';

/**
 * Password hashing for gateway-held accounts: scrypt with a per-password random salt.
 * Format: `scrypt$N$r$p$<salt b64url>$<hash b64url>`. Plain passwords are never stored or logged.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password.normalize('NFKC'), salt, KEY_LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![n, r, p].every((v) => Number.isInteger(v) && v > 0) || n > 1 << 20) return false;
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    const actual = await scrypt(password, salt, n, r, p);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Spends the same time as a real check, so an unknown username is not distinguishable by latency. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('asis-dummy-password-for-timing');
  await verifyPassword(password, await dummyHash);
}
