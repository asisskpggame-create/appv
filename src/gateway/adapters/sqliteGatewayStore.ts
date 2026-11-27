import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashOpaqueSecret } from '../security.ts';
import type { LinkedAccount, NormalizedSubscription, RegisteredDevice } from '../types.ts';
import type { GatewayStore, LocalAccount, StoredImportedSubscription, StoredRefreshSession } from './gatewayStore.ts';

// node:sqlite ships with Node >= 22.5 (no native dependency to compile).
// Loaded lazily so in-memory setups never touch it.
type SqliteModule = typeof import('node:sqlite');
type Db = InstanceType<SqliteModule['DatabaseSync']>;

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionRow {
  refresh_token_hash: string;
  session_id: string;
  user_id: string;
  username: string;
  device_id: string;
  family_id: string;
  expires_at_ms: number;
  revoked_at: string | null;
}

function toSession(row: SessionRow): StoredRefreshSession {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    deviceId: row.device_id,
    familyId: row.family_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAtMs: Number(row.expires_at_ms),
    revokedAt: row.revoked_at,
  };
}

/** AES-256-GCM key for imported subscription URLs at rest (see DATABASE_SCHEMA.md). */
function resolveEncryptionKey(env: NodeJS.ProcessEnv): Buffer {
  const secret = (env.ASIS_DB_KEY?.trim() || env.ASIS_JWT_SECRET?.trim() || '');
  if (secret.length >= 32) {
    return crypto.createHash('sha256').update(`asis-db-v1|${secret}`).digest();
  }
  console.warn('[store] ASIS_DB_KEY / ASIS_JWT_SECRET missing; stored subscription URLs use an ephemeral key.');
  return crypto.randomBytes(32);
}

function encryptText(key: Buffer, plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
}

export function decryptText(key: Buffer, packed: string): string {
  const raw = Buffer.from(packed, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/**
 * Persistent gateway store (devices, refresh sessions, imported subscriptions)
 * on SQLite. Survives restarts, so users stay logged in. Single-process only:
 * run one gateway instance per database file (use PostgreSQL for scale-out).
 */
export class SqliteGatewayStore implements GatewayStore {
  private readonly db: Db;
  private readonly key: Buffer;

  constructor(dbPath: string, env: NodeJS.ProcessEnv = process.env) {
    const sqlite = process.getBuiltinModule('node:sqlite') as SqliteModule | undefined;
    if (!sqlite) {
      throw new Error('node:sqlite is not available; Node >= 22.5 is required for ASIS_DB_PATH.');
    }
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    }
    this.db = new sqlite.DatabaseSync(dbPath);
    if (dbPath !== ':memory:') {
      try {
        fs.chmodSync(dbPath, 0o600);
      } catch {
        // Best effort (e.g. unsupported on some filesystems).
      }
    }
    this.key = resolveEncryptionKey(env);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS devices (
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        app_version TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT,
        PRIMARY KEY (user_id, device_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        refresh_token_hash TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        device_id TEXT NOT NULL,
        family_id TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_family ON sessions (family_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_device ON sessions (user_id, device_id);
      CREATE TABLE IF NOT EXISTS imported_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url_hash TEXT NOT NULL,
        source_url_enc TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_synced_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_imported_user ON imported_subscriptions (user_id);
      CREATE TABLE IF NOT EXISTS linked_accounts (
        user_id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        username TEXT NOT NULL,
        token_enc TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS local_accounts (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        sub_url_enc TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_at TEXT,
        last_login_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.purgeExpiredSessions();
  }

  close(): void {
    this.db.close();
  }

  private purgeExpiredSessions(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_at_ms < ?').run(Date.now() - PURGE_AFTER_MS);
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  registerDevice(
    userId: string,
    device: {
      deviceId: string;
      deviceName: string;
      platform: RegisteredDevice['platform'];
      appVersion: string;
    },
  ): RegisteredDevice {
    const lastSeenAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO devices
         (user_id, device_id, device_name, platform, app_version, last_seen_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(userId, device.deviceId, device.deviceName, device.platform, device.appVersion, lastSeenAt);
    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      lastSeenAt,
      revokedAt: null,
    };
  }

  listDevices(userId: string, currentDeviceId?: string): RegisteredDevice[] {
    const rows = this.db
      .prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC')
      .all(userId) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      deviceId: r.device_id as string,
      deviceName: r.device_name as string,
      platform: r.platform as RegisteredDevice['platform'],
      appVersion: r.app_version as string,
      lastSeenAt: r.last_seen_at as string,
      revokedAt: r.revoked_at,
      currentDevice: r.device_id === currentDeviceId,
    }));
  }

  isDeviceRevoked(userId: string, deviceId: string): boolean {
    const row = this.db
      .prepare('SELECT revoked_at FROM devices WHERE user_id = ? AND device_id = ?')
      .get(userId, deviceId) as { revoked_at: string | null } | undefined;
    return Boolean(row?.revoked_at);
  }

  revokeDevice(userId: string, deviceId: string): boolean {
    return this.tx(() => {
      const now = new Date().toISOString();
      const res = this.db
        .prepare('UPDATE devices SET revoked_at = ? WHERE user_id = ? AND device_id = ?')
        .run(now, userId, deviceId);
      if (Number(res.changes) === 0) return false;
      this.db
        .prepare(
          'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL',
        )
        .run(now, userId, deviceId);
      return true;
    });
  }

  private insertSession(s: StoredRefreshSession): void {
    this.db
      .prepare(
        `INSERT INTO sessions
         (refresh_token_hash, session_id, user_id, username, device_id, family_id, expires_at_ms, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(s.refreshTokenHash, s.sessionId, s.userId, s.username, s.deviceId, s.familyId, s.expiresAtMs);
  }

  issueRefreshSession(userId: string, username: string, deviceId: string): {
    refreshToken: string;
    session: StoredRefreshSession;
  } {
    const refreshToken = `rt_${crypto.randomBytes(32).toString('base64url')}`;
    const session: StoredRefreshSession = {
      sessionId: `sess_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      username,
      deviceId,
      familyId: `fam_${crypto.randomBytes(8).toString('hex')}`,
      refreshTokenHash: hashOpaqueSecret(refreshToken),
      expiresAtMs: Date.now() + REFRESH_TTL_MS,
      revokedAt: null,
    };
    this.insertSession(session);
    return { refreshToken, session };
  }

  rotateRefreshToken(
    refreshToken: string,
    deviceId: string,
  ): { refreshToken: string; session: StoredRefreshSession } | null {
    const tokenHash = hashOpaqueSecret(refreshToken);
    return this.tx(() => {
      const row = this.db.prepare('SELECT * FROM sessions WHERE refresh_token_hash = ?').get(tokenHash) as
        | SessionRow
        | undefined;
      if (!row) return null;
      const existing = toSession(row);
      const now = new Date().toISOString();

      if (existing.revokedAt) {
        // Reuse detection: revoke the whole token family.
        this.db
          .prepare('UPDATE sessions SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL')
          .run(now, existing.familyId);
        return null;
      }

      if (existing.deviceId !== deviceId || Date.now() >= existing.expiresAtMs) {
        this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE refresh_token_hash = ?').run(now, tokenHash);
        return null;
      }

      this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE refresh_token_hash = ?').run(now, tokenHash);
      const nextToken = `rt_${crypto.randomBytes(32).toString('base64url')}`;
      const nextSession: StoredRefreshSession = {
        sessionId: `sess_${crypto.randomBytes(8).toString('hex')}`,
        userId: existing.userId,
        username: existing.username,
        deviceId: existing.deviceId,
        familyId: existing.familyId,
        refreshTokenHash: hashOpaqueSecret(nextToken),
        expiresAtMs: Date.now() + REFRESH_TTL_MS,
        revokedAt: null,
      };
      this.insertSession(nextSession);
      return { refreshToken: nextToken, session: nextSession };
    });
  }

  findImportedDuplicate(userId: string, urlHash: string): StoredImportedSubscription | undefined {
    const r = this.db
      .prepare('SELECT * FROM imported_subscriptions WHERE user_id = ? AND url_hash = ?')
      .get(userId, urlHash) as Record<string, string> | undefined;
    if (!r) return undefined;
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      urlHash: r.url_hash,
      sourceUrl: decryptText(this.key, r.source_url_enc),
      createdAt: r.created_at,
      lastSyncedAt: r.last_synced_at,
    };
  }

  saveImportedSubscription(entry: StoredImportedSubscription): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO imported_subscriptions
         (id, user_id, name, url_hash, source_url_enc, created_at, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.userId,
        entry.name,
        entry.urlHash,
        encryptText(this.key, entry.sourceUrl),
        entry.createdAt,
        entry.lastSyncedAt,
      );
  }

  listImportedSubscriptions(userId: string): NormalizedSubscription[] {
    const rows = this.db
      .prepare('SELECT id, name, created_at, last_synced_at FROM imported_subscriptions WHERE user_id = ?')
      .all(userId) as Array<Record<string, string>>;
    return rows.map((r) => ({
      id: r.id,
      source: 'manual_import',
      name: r.name,
      type: 'custom',
      status: 'active',
      totalBytes: null,
      usedBytes: 0,
      remainingBytes: null,
      startsAt: r.created_at,
      expiresAt: null,
      allowedDevices: 1,
      locations: [],
      lastSyncedAt: r.last_synced_at,
    }));
  }

  deleteImportedSubscription(userId: string, subId: string): boolean {
    const res = this.db
      .prepare('DELETE FROM imported_subscriptions WHERE id = ? AND user_id = ?')
      .run(subId, userId);
    return Number(res.changes) > 0;
  }

  saveLinkedAccount(userId: string, account: LinkedAccount): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO linked_accounts (user_id, instance_id, username, token_enc, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        account.instanceId,
        account.username,
        encryptText(this.key, account.subscriptionToken),
        new Date().toISOString(),
      );
  }

  getLinkedAccount(userId: string): LinkedAccount | undefined {
    const r = this.db.prepare('SELECT * FROM linked_accounts WHERE user_id = ?').get(userId) as
      | Record<string, string>
      | undefined;
    if (!r) return undefined;
    return {
      instanceId: r.instance_id,
      username: r.username,
      subscriptionToken: decryptText(this.key, r.token_enc),
    };
  }

  private toLocalAccount(r: Record<string, unknown>): LocalAccount {
    return {
      username: String(r.username),
      passwordHash: String(r.password_hash),
      subscriptionUrl: decryptText(this.key, String(r.sub_url_enc)),
      failedAttempts: Number(r.failed_attempts),
      lockedAt: (r.locked_at as string | null) ?? null,
      lastLoginAt: (r.last_login_at as string | null) ?? null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  saveLocalAccount(input: { username: string; passwordHash: string; subscriptionUrl: string }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO local_accounts (username, password_hash, sub_url_enc, failed_attempts, locked_at, last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, 0, NULL, NULL, ?, ?)
         ON CONFLICT(username) DO UPDATE SET
           password_hash = excluded.password_hash,
           sub_url_enc = excluded.sub_url_enc,
           failed_attempts = 0,
           locked_at = NULL,
           updated_at = excluded.updated_at`,
      )
      .run(input.username, input.passwordHash, encryptText(this.key, input.subscriptionUrl), now, now);
  }

  getLocalAccount(username: string): LocalAccount | undefined {
    const r = this.db.prepare('SELECT * FROM local_accounts WHERE username = ?').get(username) as
      | Record<string, unknown>
      | undefined;
    return r ? this.toLocalAccount(r) : undefined;
  }

  countLocalAccounts(): number {
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM local_accounts').get() as { n: number | bigint };
    return Number(r.n);
  }

  reserveLoginAttempt(username: string, max: number): { allowed: boolean; attempts: number } {
    // One UPDATE does the check and the increment, so parallel requests cannot exceed `max`.
    const res = this.db
      .prepare(
        `UPDATE local_accounts
            SET failed_attempts = failed_attempts + 1,
                locked_at = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_at END
          WHERE username = ? AND failed_attempts < ?`,
      )
      .run(max, new Date().toISOString(), username, max);
    const row = this.db.prepare('SELECT failed_attempts FROM local_accounts WHERE username = ?').get(username) as
      | { failed_attempts: number | bigint }
      | undefined;
    return { allowed: Number(res.changes) === 1, attempts: row ? Number(row.failed_attempts) : max };
  }

  recordLoginSuccess(username: string): void {
    this.db
      .prepare(
        'UPDATE local_accounts SET failed_attempts = 0, locked_at = NULL, last_login_at = ? WHERE username = ?',
      )
      .run(new Date().toISOString(), username);
  }

  unlockLocalAccount(username: string, newPasswordHash?: string): boolean {
    const now = new Date().toISOString();
    const res = newPasswordHash
      ? this.db
          .prepare(
            'UPDATE local_accounts SET failed_attempts = 0, locked_at = NULL, password_hash = ?, updated_at = ? WHERE username = ?',
          )
          .run(newPasswordHash, now, username)
      : this.db
          .prepare('UPDATE local_accounts SET failed_attempts = 0, locked_at = NULL, updated_at = ? WHERE username = ?')
          .run(now, username);
    return Number(res.changes) === 1;
  }

  deleteLocalAccount(username: string): boolean {
    return Number(this.db.prepare('DELETE FROM local_accounts WHERE username = ?').run(username).changes) === 1;
  }
}
