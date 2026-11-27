import React, { useMemo, useState } from 'react';
import { Link2, Lock, User } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import { BrandLogo, Button, Dialog, Input, SegmentedControl, StatusBanner } from '../../design-system/components';
import { authTranslations } from './authTranslations';
import { AuthClientError, HttpAuthClient, createDiagnosticId } from './authClient';
import { getStableDeviceId, isNativeApp } from './sessionStore';
import { validateCredentials } from './validation';
import type { AuthError, AuthSession } from './types';
import { SIGNUP_URL } from '../../signupLink';

interface LoginScreenProps {
  onAuthenticated: (session: AuthSession) => void;
  /** Lets people without an account add a subscription link by hand. */
  onContinueWithoutAccount?: () => void;
  initialSessionExpired?: boolean;
}

export function LoginScreen({
  onAuthenticated,
  onContinueWithoutAccount,
  initialSessionExpired = false,
}: LoginScreenProps) {
  const { locale, setLocale } = usePreferences();
  const isFa = locale === 'fa-IR';
  const t = authTranslations[locale];

  const client = useMemo(() => new HttpAuthClient('/api/v1'), []);
  const [deviceId] = useState(() => getStableDeviceId());

  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState('');
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

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const fieldErrors = validateCredentials({ username, password }, t);
  const usernameError = submittedOnce ? fieldErrors.username : undefined;
  const passwordError = submittedOnce ? fieldErrors.password : undefined;
  const linkError = (() => {
    const v = link.trim();
    if (!v) return t.validationLinkRequired;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:' ? undefined : t.validationLinkInvalid;
    } catch {
      return t.validationLinkInvalid;
    }
  })();

  const errorText = (err: AuthError): { title: string; body: string } => {
    if (err.code.startsWith('AUTH_LINK')) return { title: t.errorLinkTitle, body: t.errorLinkBody };
    if (err.code === 'AUTH_ACCOUNT_LOCKED') return { title: t.errorLockedTitle, body: t.errorLockedBody };
    switch (err.category) {
      case 'authentication_failure':
        return { title: t.errorInvalidCredentialsTitle, body: t.errorInvalidCredentialsBody };
      case 'account_suspended':
        return { title: t.errorSuspendedTitle, body: t.errorSuspendedBody };
      case 'session_expired':
        return { title: t.errorSessionExpiredTitle, body: t.errorSessionExpiredBody };
      case 'network_error':
        return { title: t.errorNetworkTitle, body: t.errorNetworkBody };
      case 'backend_unavailable':
        return { title: t.errorBackendTitle, body: t.errorBackendBody };
      default:
        return { title: t.errorInvalidCredentialsTitle, body: err.message };
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedOnce(true);
    setAuthError(null);
    if (mode === 'link' ? linkError : fieldErrors.username || fieldErrors.password) return;

    setIsLoading(true);
    try {
      const device = {
        deviceId,
        deviceName: isNativeApp() ? 'ASiS VPN Android' : 'ASiS Web Workspace',
        platform: (isNativeApp() ? 'android' : 'web') as 'android' | 'web',
        appVersion: '0.4.12',
      };
      const session =
        mode === 'link'
          ? await client.loginWithLink(link.trim(), device)
          : await client.login({ username: username.trim(), password }, device);
      setPassword('');
      setLink('');
      onAuthenticated(session);
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

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecoveryError(null);
    setRecoveryNotice(null);
    if (recoveryUsername.trim().length < 3) {
      setRecoveryError(t.validationUsernameMin);
      return;
    }
    setRecoveryLoading(true);
    try {
      const res = await client.requestPasswordRecovery(recoveryUsername.trim());
      setRecoveryNotice(res.workflowMessage);
    } catch (err) {
      setRecoveryError(err instanceof AuthClientError ? err.authError.message : t.recoveryNotConnectedNote);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const err = authError ? errorText(authError) : null;

  const inputCls = '!bg-[var(--asis-surface-2)]/60';
  return (
    <div className="asis-canvas-ambient flex min-h-screen flex-col text-[var(--asis-text-primary)]">
      {/* Brand area */}
      <section className="relative overflow-hidden px-6 pb-14 pt-4">
        <svg
          aria-hidden="true"
          viewBox="0 0 400 260"
          className="pointer-events-none absolute inset-x-0 top-0 h-full w-full text-[var(--asis-primary)]"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill="none" stroke="currentColor">
            <circle cx="200" cy="120" r="64" strokeOpacity="0.16" />
            <circle cx="200" cy="120" r="104" strokeOpacity="0.11" />
            <circle cx="200" cy="120" r="148" strokeOpacity="0.07" />
            <circle cx="200" cy="120" r="196" strokeOpacity="0.045" />
          </g>
        </svg>

        <div className="relative flex justify-end">
          <button
            type="button"
            onClick={() => setLocale(isFa ? 'en-US' : 'fa-IR')}
            className="asis-glass cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium text-[var(--asis-text-secondary)]"
          >
            {isFa ? 'English' : 'فارسی'}
          </button>
        </div>

        <div className="relative mt-2 flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span
              aria-hidden="true"
              className="asis-orb absolute inset-0 rounded-full opacity-25"
            />
            <span aria-hidden="true" className="asis-halo" />
            <BrandLogo className="relative h-20 w-20" glow />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight" dir="ltr">
              ASiS VPN
            </h1>
            <p className="text-sm text-[var(--asis-text-secondary)]">
              {isFa ? 'اینترنت آزاد، امن و پایدار' : 'Open, secure, reliable internet'}
            </p>
          </div>
        </div>
      </section>

      {/* Sign-in sheet */}
      <div className="asis-glass relative -mt-6 flex-1 rounded-t-[28px] px-6 pb-10 pt-7">
        <div className="mx-auto w-full max-w-md">
        <h2 className="mb-1 text-lg font-bold">{isFa ? 'ورود به حساب' : 'Sign in'}</h2>
        <p className="mb-5 text-sm text-[var(--asis-text-secondary)]">
          {isFa ? 'با نام کاربری یا لینک اشتراک وارد شوید.' : 'Use your username or a subscription link.'}
        </p>

        <div className="mb-5 [&>div]:flex [&>div]:w-full [&>div>button]:flex-1">
          <SegmentedControl<'password' | 'link'>
            ariaLabel={isFa ? 'روش ورود' : 'Sign-in method'}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setAuthError(null);
            }}
            options={[
              { value: 'password', label: isFa ? 'نام کاربری' : 'Username' },
              { value: 'link', label: isFa ? 'لینک اشتراک' : 'Subscription link' },
            ]}
          />
        </div>

        {err && (
          <div className="mb-4">
            <StatusBanner tone={authError?.category === 'backend_unavailable' ? 'warning' : 'error'} title={err.title} description={err.body} />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'password' ? (
            <>
              <Input
                label={t.usernameLabel}
                icon={<User className="h-4 w-4" aria-hidden="true" />}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                disabled={isLoading}
                error={usernameError}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (authError) setAuthError(null);
                }}
                className={inputCls}
              />
              <Input
                label={t.passwordLabel}
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                name="password"
                type="password"
                autoComplete="current-password"
                allowPasswordToggle
                showPasswordLabel={t.showPasswordLabel}
                hidePasswordLabel={t.hidePasswordLabel}
                value={password}
                disabled={isLoading}
                error={passwordError}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                className={inputCls}
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
                  className="text-[13px] font-medium text-[var(--asis-accent-fg)]"
                >
                  {isFa ? 'رمز عبور را فراموش کرده‌اید؟' : 'Forgot your password?'}
                </button>
              </div>
            </>
          ) : (
            <Input
              label={t.linkLabel}
              icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
              name="subscription-link"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder={t.linkPlaceholder}
              hint={t.linkHint}
              value={link}
              disabled={isLoading}
              error={submittedOnce ? linkError : undefined}
              onChange={(e) => {
                setLink(e.target.value);
                if (authError) setAuthError(null);
              }}
              className={inputCls}
            />
          )}

          <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full !rounded-full">
            {isLoading ? t.submitSigningIn : isFa ? 'ورود' : 'Sign in'}
          </Button>
        </form>

        {(SIGNUP_URL || onContinueWithoutAccount) && (
          <div className="mt-8 flex flex-col gap-2.5 border-t border-[var(--asis-border)] pt-6">
            {mode === 'password' && SIGNUP_URL && (
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => {
                  if (SIGNUP_URL) window.open(SIGNUP_URL, '_blank', 'noopener,noreferrer');
                }}
              >
                {isFa ? 'ساخت حساب کاربری' : 'Create an account'}
              </Button>
            )}
            {onContinueWithoutAccount && (
              <Button variant="ghost" size="md" className="w-full" onClick={onContinueWithoutAccount}>
                {isFa ? 'ادامه بدون حساب' : 'Continue without an account'}
              </Button>
            )}
          </div>
        )}
        </div>
      </div>

      <Dialog open={recoveryOpen} onClose={() => setRecoveryOpen(false)} title={t.recoveryTitle}>
        <form onSubmit={handleRecovery} noValidate className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--asis-text-secondary)]">{t.recoveryDescription}</p>
          {recoveryError && <StatusBanner tone="error" title={recoveryError} />}
          {recoveryNotice && <StatusBanner tone="info" title={recoveryNotice} />}
          <Input
            label={t.recoveryUsernameLabel}
            value={recoveryUsername}
            onChange={(e) => setRecoveryUsername(e.target.value)}
            placeholder={t.usernamePlaceholder}
            disabled={recoveryLoading}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRecoveryOpen(false)} disabled={recoveryLoading}>
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
