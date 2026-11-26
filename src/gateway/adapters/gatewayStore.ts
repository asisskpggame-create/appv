import crypto from 'node:crypto';
import { hashOpaqueSecret } from '../security.ts';
import type { NormalizedSubscription, RegisteredDevice } from '../types.ts';

export interface StoredRefreshSession {
  sessionId: string;
  userId: string;
  username: string;
  deviceId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAtMs: number;
  revokedAt: string | null;
}

export interface StoredImportedSubscription {
  id: string;
  userId: string;
  name: string;
  urlHash: string;
  /** Stored only on server; never echoed back in logs or analytics. */
  sourceUrl: string;
  createdAt: string;
  lastSyncedAt: string;
}

/**
 * Process-local session, device, and imported-subscription store for the AI Studio gateway.
 * Production deployments back this interface with PostgreSQL + Redis (see DATABASE_SCHEMA.md).
 */
export class InMemoryGatewayStore {
  private readonly sessions = new Map<string, StoredRefreshSession>();
  private readonly devices = new Map<string, RegisteredDevice & { userId: string }>();
  private readonly importedSubscriptions = new Map<string, StoredImportedSubscription>();

  registerDevice(
    userId: string,
    device: {
      deviceId: string;
      deviceName: string;
      platform: RegisteredDevice['platform'];
      appVersion: string;
    },
  ): RegisteredDevice {
    const record: RegisteredDevice & { userId: string } = {
      userId,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      lastSeenAt: new Date().toISOString(),
      revokedAt: null,
    };
    this.devices.set(`${userId}:${device.deviceId}`, record);
    return record;
  }

  listDevices(userId: string, currentDeviceId?: string): RegisteredDevice[] {
    const out: RegisteredDevice[] = [];
    for (const dev of this.devices.values()) {
      if (dev.userId === userId) {
        out.push({
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          platform: dev.platform,
          appVersion: dev.appVersion,
          lastSeenAt: dev.lastSeenAt,
          revokedAt: dev.revokedAt,
          currentDevice: dev.deviceId === currentDeviceId,
        });
      }
    }
    return out;
  }

  isDeviceRevoked(userId: string, deviceId: string): boolean {
    const dev = this.devices.get(`${userId}:${deviceId}`);
    return Boolean(dev?.revokedAt);
  }

  revokeDevice(userId: string, deviceId: string): boolean {
    const key = `${userId}:${deviceId}`;
    const dev = this.devices.get(key);
    if (!dev) return false;
    dev.revokedAt = new Date().toISOString();

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.deviceId === deviceId && !session.revokedAt) {
        session.revokedAt = new Date().toISOString();
      }
    }
    return true;
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
      expiresAtMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      revokedAt: null,
    };
    this.sessions.set(session.refreshTokenHash, session);
    return { refreshToken, session };
  }

  rotateRefreshToken(
    refreshToken: string,
    deviceId: string,
  ): { refreshToken: string; session: StoredRefreshSession } | null {
    const tokenHash = hashOpaqueSecret(refreshToken);
    const existing = this.sessions.get(tokenHash);
    if (!existing) return null;

    if (existing.revokedAt) {
      // Reuse detection: revoke all sessions in the same family
      for (const s of this.sessions.values()) {
        if (s.familyId === existing.familyId && !s.revokedAt) {
          s.revokedAt = new Date().toISOString();
        }
      }
      return null;
    }

    if (existing.deviceId !== deviceId || Date.now() >= existing.expiresAtMs) {
      existing.revokedAt = new Date().toISOString();
      return null;
    }

    existing.revokedAt = new Date().toISOString();
    const nextToken = `rt_${crypto.randomBytes(32).toString('base64url')}`;
    const nextSession: StoredRefreshSession = {
      sessionId: `sess_${crypto.randomBytes(8).toString('hex')}`,
      userId: existing.userId,
      username: existing.username,
      deviceId: existing.deviceId,
      familyId: existing.familyId,
      refreshTokenHash: hashOpaqueSecret(nextToken),
      expiresAtMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
      revokedAt: null,
    };
    this.sessions.set(nextSession.refreshTokenHash, nextSession);
    return { refreshToken: nextToken, session: nextSession };
  }

  findImportedDuplicate(userId: string, urlHash: string): StoredImportedSubscription | undefined {
    for (const sub of this.importedSubscriptions.values()) {
      if (sub.userId === userId && sub.urlHash === urlHash) {
        return sub;
      }
    }
    return undefined;
  }

  saveImportedSubscription(entry: StoredImportedSubscription): void {
    this.importedSubscriptions.set(entry.id, entry);
  }

  listImportedSubscriptions(userId: string): NormalizedSubscription[] {
    const out: NormalizedSubscription[] = [];
    for (const sub of this.importedSubscriptions.values()) {
      if (sub.userId === userId) {
        out.push({
          id: sub.id,
          source: 'manual_import',
          name: sub.name,
          type: 'custom',
          status: 'active',
          totalBytes: null,
          usedBytes: 0,
          remainingBytes: null,
          startsAt: sub.createdAt,
          expiresAt: null,
          allowedDevices: 1,
          locations: [],
          lastSyncedAt: sub.lastSyncedAt,
        });
      }
    }
    return out;
  }

  deleteImportedSubscription(userId: string, subId: string): boolean {
    const sub = this.importedSubscriptions.get(subId);
    if (!sub || sub.userId !== userId) return false;
    return this.importedSubscriptions.delete(subId);
  }
}
