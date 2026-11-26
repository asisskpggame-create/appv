import React, { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import { Button, Card } from '../../design-system/components';
import { AuthForm, HttpAuthClient, type AuthSession } from '../auth';
import { DeviceManager } from './DeviceManager';

interface AccountViewProps {
  session: AuthSession | null;
  onSessionChange: (session: AuthSession | null) => void;
  onNavigateToSubscriptions?: () => void;
}

export function AccountView({
  session,
  onSessionChange,
  onNavigateToSubscriptions,
}: AccountViewProps) {
  const { locale } = usePreferences();
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
    <div className="space-y-8 text-start">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
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

      <DeviceManager session={session} isFa={isFa} />
    </div>
  );
}
