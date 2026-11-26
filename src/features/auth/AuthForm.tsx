import React, { useMemo, useState } from 'react';
import { Lock, LogOut, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  BrandLogo,
  Button,
  Card,
  Dialog,
  Input,
  StatusBanner,
} from '../../design-system/components';
import { authTranslations } from './authTranslations';
import { AuthClientError, HttpAuthClient, createDiagnosticId } from './authClient';
import { getOrCreateWebDeviceId } from './sessionStore';
import { validateCredentials } from './validation';
import type { AuthClient, AuthError, AuthSession } from './types';

export { validateCredentials };

export interface AuthFormProps {
  /** Optional custom AuthClient (e.g. for dependency injection in tests or native bridge). */
  authClient?: AuthClient;
  /** Optional callback fired only when a real verified AuthSession is returned by authClient. */
  onAuthenticated?: (session: AuthSession) => void;
  /** Optional navigation callback to jump straight to manual subscription import. */
  onUseManualSubscription?: () => void;
  /** Optional externally detected expired session notice. */
  initialSessionExpired?: boolean;
}

export function AuthForm({
  authClient,
  onAuthenticated,
  onUseManualSubscription,
  initialSessionExpired = false,
}: AuthFormProps) {
  const { locale } = usePreferences();
  const t = authTranslations[locale];

  const client = useMemo(() => authClient ?? new HttpAuthClient('/api/v1'), [authClient]);
  const [deviceId] = useState(() => getOrCreateWebDeviceId());

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ username: boolean; password: boolean }>({
    username: false,
    password: false,
  });
  const [submittedOnce, setSubmittedOnce] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthError | null>(() =>
    initialSessionExpired
      ? {
          code: 'AUTH_SESSION_EXPIRED',
          category: 'session_expired',
          message: t.errorSessionExpiredBody,
          diagnosticId: createDiagnosticId(),
          recoveryAction: 'reauthenticate',
        }
      : null,
  );
  const [session, setSession] = useState<AuthSession | null>(null);

  // Password recovery modal state
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<AuthError | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const fieldErrors = validateCredentials({ username, password }, t);
  const showUsernameError = (touched.username || submittedOnce) ? fieldErrors.username : undefined;
  const showPasswordError = (touched.password || submittedOnce) ? fieldErrors.password : undefined;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedOnce(true);
    setAuthError(null);

    const validation = validateCredentials({ username, password }, t);
    if (validation.username || validation.password) {
      return;
    }

    setIsLoading(true);
    try {
      const authenticated = await client.login(
        { username: username.trim(), password },
        {
          deviceId,
          deviceName: 'ASiS Web Workspace',
          platform: 'web',
          appVersion: '0.2.0',
        },
      );
      // Clear password from React state immediately after authentication
      setPassword('');
      setSession(authenticated);
      onAuthenticated?.(authenticated);
    } catch (err) {
      if (err instanceof AuthClientError) {
        setAuthError(err.authError);
      } else {
        setAuthError({
          code: 'AUTH_UNKNOWN_ERROR',
          category: 'network_error',
          message: t.errorNetworkBody,
          diagnosticId: createDiagnosticId(),
          recoveryAction: 'retry_request',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      await client.logout(session.tokens.accessToken, session.deviceId);
    } finally {
      setSession(null);
      setPassword('');
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoveryNotice(null);

    if (!recoveryUsername.trim() || recoveryUsername.trim().length < 3) {
      setRecoveryError({
        code: 'VALIDATION_USERNAME_REQUIRED',
        category: 'validation_error',
        message: t.validationUsernameMin,
        diagnosticId: createDiagnosticId(),
      });
      return;
    }

    setRecoveryLoading(true);
    try {
      const res = await client.requestPasswordRecovery(recoveryUsername.trim());
      setRecoveryNotice(res.workflowMessage);
    } catch (err) {
      if (err instanceof AuthClientError) {
        setRecoveryError(err.authError);
      } else {
        setRecoveryError({
          code: 'GATEWAY_NOT_CONNECTED',
          category: 'backend_unavailable',
          message: t.recoveryNotConnectedNote,
          diagnosticId: createDiagnosticId(),
        });
      }
    } finally {
      setRecoveryLoading(false);
    }
  };

  const renderErrorTitle = (err: AuthError): string => {
    switch (err.category) {
      case 'authentication_failure':
        return t.errorInvalidCredentialsTitle;
      case 'account_suspended':
        return t.errorSuspendedTitle;
      case 'session_expired':
        return t.errorSessionExpiredTitle;
      case 'network_error':
        return t.errorNetworkTitle;
      case 'backend_unavailable':
        return t.errorBackendTitle;
      default:
        return t.errorInvalidCredentialsTitle;
    }
  };

  const renderErrorBody = (err: AuthError): string => {
    switch (err.category) {
      case 'authentication_failure':
        return t.errorInvalidCredentialsBody;
      case 'account_suspended':
        return t.errorSuspendedBody;
      case 'session_expired':
        return t.errorSessionExpiredBody;
      case 'network_error':
        return t.errorNetworkBody;
      case 'backend_unavailable':
        return t.errorBackendBody;
      default:
        return err.message;
    }
  };

  if (session) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card elevated className="space-y-5 text-start">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--asis-border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t.sessionActiveTitle}</h2>
                <p className="text-xs text-[var(--asis-text-secondary)]">
                  {session.user.username} · {session.user.status}
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[var(--asis-border)] rounded-xl border border-[var(--asis-border)]">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-[var(--asis-text-secondary)]">Device ID</span>
              <span className="font-mono text-xs">{session.deviceId}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-[var(--asis-text-secondary)]">Token Expiry</span>
              <span className="font-mono text-xs">
                {new Date(session.tokens.expiresAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleLogout}
              loading={isLoading}
              icon={<LogOut className="w-4 h-4" aria-hidden="true" />}
            >
              {t.sessionLogout}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-12 items-start">
      {/* Primary Authentication Card */}
      <Card elevated className="lg:col-span-7 space-y-6 text-start" padding="lg">
        <div className="space-y-2 border-b border-[var(--asis-border)] pb-5">
          <div className="flex items-center gap-3">
            <BrandLogo className="w-8 h-8 shrink-0" />
            <h1 className="text-xl font-bold tracking-tight">{t.screenTitle}</h1>
          </div>
          <p className="text-sm leading-relaxed text-[var(--asis-text-secondary)]">
            {t.screenSubtitle}
          </p>
        </div>

        {authError && (
          <StatusBanner
            tone={authError.category === 'backend_unavailable' ? 'warning' : 'error'}
            title={renderErrorTitle(authError)}
            description={`${renderErrorBody(authError)} (${t.errorCodeLabel}: ${authError.code} · ${t.diagnosticIdLabel}: ${authError.diagnosticId})`}
          />
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label={t.usernameLabel}
            name="username"
            autoComplete="username"
            placeholder={t.usernamePlaceholder}
            value={username}
            disabled={isLoading}
            error={showUsernameError}
            onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
            onChange={(e) => {
              setUsername(e.target.value);
              if (authError) setAuthError(null);
            }}
          />

          <div className="space-y-1.5">
            <Input
              label={t.passwordLabel}
              name="password"
              type="password"
              autoComplete="current-password"
              allowPasswordToggle
              showPasswordLabel={t.showPasswordLabel}
              hidePasswordLabel={t.hidePasswordLabel}
              placeholder={t.passwordPlaceholder}
              value={password}
              disabled={isLoading}
              error={showPasswordError}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              onChange={(e) => {
                setPassword(e.target.value);
                if (authError) setAuthError(null);
              }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRecoveryUsername(username);
                  setRecoveryError(null);
                  setRecoveryNotice(null);
                  setRecoveryOpen(true);
                }}
                className="text-xs font-medium text-[var(--asis-accent-fg)] hover:underline cursor-pointer"
              >
                {t.forgotPasswordLink}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            icon={!isLoading ? <Lock className="w-4 h-4" aria-hidden="true" /> : undefined}
            className="w-full"
          >
            {isLoading ? t.submitSigningIn : t.submitSignIn}
          </Button>
        </form>
      </Card>

      {/* Side Panel: Security Safeguards & Direct Subscription Import */}
      <div className="lg:col-span-5 space-y-6 text-start">
        <Card className="space-y-4">
          <div className="flex items-center gap-2.5 text-[var(--asis-accent-fg)]">
            <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-[var(--asis-text-primary)]">
              {t.securityNoteTitle}
            </h2>
          </div>

          <p className="text-xs leading-relaxed text-[var(--asis-text-secondary)]">
            {t.securityNoteBody}
          </p>

          <div className="divide-y divide-[var(--asis-border)] border-t border-[var(--asis-border)] pt-2 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-[var(--asis-text-secondary)]">
                {locale === 'fa-IR' ? 'مدیریت نشست دستگاه‌ها' : 'Device Sessions'}
              </span>
              <span className="font-medium text-[var(--asis-text-primary)]">
                {locale === 'fa-IR' ? 'توکن مجزا برای هر دستگاه' : 'Per-device tokens'}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-[var(--asis-text-secondary)]">
                {locale === 'fa-IR' ? 'همگام‌سازی اشتراک' : 'Subscription Sync'}
              </span>
              <span className="font-medium text-[var(--asis-text-primary)]">
                {locale === 'fa-IR' ? 'خودکار پس از ورود' : 'Automatic on sign-in'}
              </span>
            </div>
          </div>

          {onUseManualSubscription && (
            <div className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={onUseManualSubscription}
              >
                {locale === 'fa-IR'
                  ? 'ورود با لینک اشتراک بدون حساب کاربری'
                  : 'Import Subscription Link Instead'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Password Recovery Modal */}
      <Dialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        title={t.recoveryTitle}
      >
        <form onSubmit={handleRecoverySubmit} noValidate className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--asis-text-secondary)]">
            {t.recoveryDescription}
          </p>

          {recoveryError && (
            <StatusBanner
              tone={recoveryError.category === 'backend_unavailable' ? 'warning' : 'error'}
              title={recoveryError.code}
              description={
                recoveryError.category === 'backend_unavailable'
                  ? t.recoveryNotConnectedNote
                  : recoveryError.message
              }
            />
          )}

          {recoveryNotice && (
            <StatusBanner tone="info" title={recoveryNotice} />
          )}

          <Input
            label={t.recoveryUsernameLabel}
            value={recoveryUsername}
            onChange={(e) => setRecoveryUsername(e.target.value)}
            placeholder={t.usernamePlaceholder}
            disabled={recoveryLoading}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecoveryOpen(false)}
              disabled={recoveryLoading}
            >
              {t.recoveryCancel}
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={recoveryLoading}>
              {recoveryLoading ? t.recoverySubmitting : t.recoverySubmit}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
