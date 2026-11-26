import React, { useEffect, useState } from 'react';
import { Laptop, Monitor, RefreshCw, ShieldCheck, Smartphone, Tablet, Trash2, AlertTriangle } from 'lucide-react';
import { Button, Card, EmptyState, SkeletonList, StatusBanner } from '../../design-system/components';
import type { AuthSession } from '../auth';

export interface DeviceRow {
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  lastSeenAt: string;
  revokedAt: string | null;
  currentDevice?: boolean;
  ipAddress?: string;
}

interface DeviceManagerProps {
  session: AuthSession;
  isFa: boolean;
}

export function DeviceManager({ session, isFa }: DeviceManagerProps) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/devices', {
        headers: {
          Authorization: `Bearer ${session.tokens.accessToken}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch devices');
      }
      const data = (await res.json()) as { items?: DeviceRow[] };
      const items = data.items ?? [];
      // Mark current device if matching session deviceId
      const annotated = items.map((d) => ({
        ...d,
        currentDevice: d.deviceId === session.deviceId,
      }));
      setDevices(annotated);
    } catch {
      setError(isFa ? 'خطا در برقراری ارتباط با سرور برای دریافت فهرست دستگاه‌ها' : 'Unable to synchronize device sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDevices();
  }, [session.tokens.accessToken, session.deviceId]);

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    setError(null);
    try {
      const res = await fetch('/api/v1/devices/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.tokens.accessToken}`,
        },
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) {
        throw new Error('Failed to revoke device');
      }
      await fetchDevices();
    } catch {
      setError(isFa ? 'خطا در لغو دسترسی دستگاه' : 'Failed to revoke device session.');
    } finally {
      setRevokingId(null);
      setConfirmRevokeId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const lower = platform.toLowerCase();
    if (lower.includes('android') || lower.includes('ios') || lower.includes('phone')) {
      return Smartphone;
    }
    if (lower.includes('ipad') || lower.includes('tablet')) {
      return Tablet;
    }
    if (lower.includes('mac') || lower.includes('windows') || lower.includes('linux') || lower.includes('desktop')) {
      return Laptop;
    }
    return Monitor;
  };

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {isFa ? 'دستگاه‌ها و نشست‌های فعال' : 'Active Devices & Sessions'}
          </h3>
          <p className="text-xs text-[var(--asis-text-secondary)] mt-0.5">
            {isFa
              ? 'مدیریت دستگاه‌های متصل به حساب کاربری و لغو دسترسی نشست‌های مشکوک'
              : 'Manage authenticated devices and revoke unauthorized client sessions'}
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={() => void fetchDevices()}
        >
          {isFa ? 'بروزرسانی فهرست' : 'Sync Devices'}
        </Button>
      </div>

      {error && <StatusBanner tone="error" title={error} />}

      {loading && devices.length === 0 ? (
        <Card padding="sm">
          <SkeletonList rows={3} />
        </Card>
      ) : devices.length === 0 ? (
        <EmptyState
          title={isFa ? 'هیچ دستگاه فعالی یافت نشد' : 'No active devices found'}
          description={
            isFa
              ? 'هیچ نشست فعالی در حال حاضر برای حساب شما ثبت نشده است.'
              : 'No active device sessions are currently registered for this account.'
          }
          actionLabel={isFa ? 'تلاش مجدد' : 'Refresh'}
          onAction={() => void fetchDevices()}
        />
      ) : (
        <Card padding="none" className="divide-y divide-[var(--asis-border)] overflow-hidden">
          {devices.map((dev) => {
            const IconComponent = getPlatformIcon(dev.platform);
            const isCurrent = dev.currentDevice;
            const isRevoked = Boolean(dev.revokedAt);
            const isConfirming = confirmRevokeId === dev.deviceId;

            return (
              <div
                key={dev.deviceId}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 transition-colors ${
                  isCurrent ? 'bg-[var(--asis-primary-soft)]/20' : ''
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isCurrent
                        ? 'bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]'
                        : 'bg-[var(--asis-surface-2)] text-[var(--asis-text-secondary)]'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold truncate">{dev.deviceName}</p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--asis-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--asis-accent-fg)]">
                          <ShieldCheck className="w-3 h-3" />
                          {isFa ? 'این دستگاه' : 'Current Device'}
                        </span>
                      )}
                      {isRevoked && (
                        <span className="rounded-full bg-red-100 dark:bg-red-950/50 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          {isFa ? 'لغو شده' : 'Revoked'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--asis-text-secondary)]">
                      <span>{dev.platform}</span>
                      <span>·</span>
                      <span>v{dev.appVersion}</span>
                      {dev.ipAddress && (
                        <>
                          <span>·</span>
                          <span>{dev.ipAddress}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {isFa ? 'آخرین فعالیت: ' : 'Last seen: '}
                        {new Date(dev.lastSeenAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isConfirming ? (
                    <div className="flex items-center gap-2 rounded-lg bg-[var(--asis-surface-2)] p-1.5 border border-[var(--asis-border)]">
                      <span className="text-xs font-medium px-2 text-[var(--asis-text-primary)] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        {isFa ? 'مطمئنید؟' : 'Revoke session?'}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={revokingId === dev.deviceId}
                        onClick={() => void handleRevoke(dev.deviceId)}
                      >
                        {isFa ? 'بله' : 'Yes'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRevokeId(null)}
                      >
                        {isFa ? 'خیر' : 'No'}
                      </Button>
                    </div>
                  ) : (
                    !isRevoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isCurrent}
                        title={isCurrent ? (isFa ? 'نمی‌توانید دستگاه فعلی را لغو کنید' : 'Cannot revoke current session') : undefined}
                        onClick={() => setConfirmRevokeId(dev.deviceId)}
                        icon={<Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" aria-hidden="true" />}
                      >
                        {isFa ? 'لغو دسترسی' : 'Revoke'}
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
