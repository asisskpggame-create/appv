import React, { useState } from 'react';
import { ChevronRight, Globe, Layers, LifeBuoy, LogOut, ShieldCheck, User } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import { Button, Card } from '../../design-system/components';
import { AuthForm, HttpAuthClient, type AuthSession } from '../auth';
import { DeviceManager } from './DeviceManager';

interface AccountViewProps {
  session: AuthSession | null;
  onSessionChange: (session: AuthSession | null) => void;
  onNavigateToSubscriptions?: () => void;
  onNavigateToSupport?: () => void;
  onNavigateToGateway?: () => void;
  subscriptionCount?: number;
}

export function AccountView({
  session,
  onSessionChange,
  onNavigateToSubscriptions,
  onNavigateToSupport,
  onNavigateToGateway,
  subscriptionCount = 0,
}: AccountViewProps) {
  const { locale, dir } = usePreferences();
  const isFa = locale === 'fa-IR';

  const [loggingOut, setLoggingOut] = useState(false);

  if (!session) {
    return (
      <AuthForm
        onAuthenticated={onSessionChange}
        onUseManualSubscription={onNavigateToSubscriptions}
      />
    );
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const client = new HttpAuthClient('/api/v1');
      await client.logout(session.tokens.accessToken, session.deviceId);
    } catch {
      // Ignore network errors on logout
    } finally {
      setLoggingOut(false);
      onSessionChange(null);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5 text-start md:max-w-none md:space-y-8">
      <Card elevated className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#3B98FF]/70 bg-[#071a3d]/60 text-[var(--asis-accent-fg)] shadow-[0_0_22px_-2px_rgba(29,134,255,0.6)]">
            <User className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{session.user.username}</h2>
            <p className="font-mono text-xs text-[var(--asis-text-secondary)] mt-0.5">
              Status: <span className="text-[#16A34A] font-medium">{session.user.status}</span> · Device ID: {session.deviceId.slice(0, 12)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={loggingOut}
            icon={<LogOut className="w-4 h-4" aria-hidden="true" />}
            onClick={() => void handleLogout()}
          >
            {isFa ? 'خروج امن' : 'Sign Out'}
          </Button>
        </div>
      </Card>

      {/* Shortcuts (subscriptions and support live here on phones) */}
      <Card padding="none" className="divide-y divide-[var(--asis-border)]">
        {(
          [
            onNavigateToSubscriptions && {
              key: 'subs',
              icon: Layers,
              label: isFa ? 'اشتراک‌های من' : 'My subscriptions',
              hint: subscriptionCount > 0 ? String(subscriptionCount) : '',
              onClick: onNavigateToSubscriptions,
            },
            onNavigateToSupport && {
              key: 'support',
              icon: LifeBuoy,
              label: isFa ? 'پشتیبانی و راهنما' : 'Support & help',
              hint: '',
              onClick: onNavigateToSupport,
            },
          ] as const
        )
          .filter(Boolean)
          .map((row) => {
            const r = row as { key: string; icon: React.ComponentType<{ className?: string }>; label: string; hint: string; onClick: () => void };
            const Icon = r.icon;
            return (
              <button
                key={r.key}
                type="button"
                onClick={r.onClick}
                className="flex w-full items-center gap-3 px-4 py-4 text-start text-sm font-medium cursor-pointer"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex-1">{r.label}</span>
                {r.hint && <span className="font-mono text-xs text-[var(--asis-text-secondary)]">{r.hint}</span>}
                <ChevronRight className={`h-4 w-4 text-[var(--asis-text-secondary)] ${dir === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            );
          })}
      </Card>

      <DeviceManager session={session} isFa={isFa} />
    </div>
  );
}
