import React, { useMemo, useState } from 'react';
import { Link2, Lock, User } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import { BrandLogo, Button, Dialog, Input, StatusBanner } from '../../design-system/components';
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

/** Glowing city skyline (Tehran, Milad Tower) used at the bottom of the login screen. */
function Skyline() {
  const buildings: Array<[number, number, number]> = [
    [0, 70, 26], [26, 100, 22], [48, 60, 30], [78, 120, 20], [98, 84, 28], [126, 54, 24],
    [250, 90, 26], [276, 130, 22], [298, 76, 30], [328, 108, 24], [352, 66, 28], [380, 96, 20],
  ];
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sk-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1D86FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#030816" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="sk-tower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9BD0FF" />
          <stop offset="1" stopColor="#1D86FF" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="210" rx="260" ry="70" fill="#1D86FF" opacity="0.28" />
      {buildings.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={200 - h} width={w} height={h} fill="url(#sk-fade)" stroke="#3B98FF" strokeOpacity="0.5" strokeWidth="0.6" />
          {Array.from({ length: Math.floor(h / 14) }).map((_, r) => (
            <rect key={r} x={x + 5} y={200 - h + 8 + r * 14} width={w - 10} height="2" fill="#9BD0FF" opacity={r % 3 === 0 ? 0.2 : 0.55} />
          ))}
        </g>
      ))}
      {/* Milad Tower */}
      <g stroke="#9BD0FF" strokeWidth="0.8" fill="url(#sk-tower)">
        <path d="M196 200 L199 78 L201 78 L204 200 Z" />
        <ellipse cx="200" cy="72" rx="13" ry="7" />
        <ellipse cx="200" cy="62" rx="9" ry="4" />
        <rect x="199.3" y="26" width="1.4" height="36" />
        <path d="M185 200 L196 120 L204 120 L215 200 Z" opacity="0.8" />
      </g>
      <rect x="0" y="198" width="400" height="2" fill="#3B98FF" opacity="0.7" />
    </svg>
  );
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

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden text-[var(--asis-text-primary)]"
      style={{
        background:
          'radial-gradient(ellipse 90% 45% at 50% 18%, rgba(29,134,255,0.38), transparent 70%), linear-gradient(180deg, #030816 0%, #061433 60%, #030816 100%)',
      }}
    >
      {/* star-dust */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(rgba(150,200,255,0.55) 1px, transparent 1.2px), radial-gradient(rgba(150,200,255,0.3) 1px, transparent 1.2px)',
          backgroundSize: '46px 46px, 71px 71px',
          backgroundPosition: '0 0, 20px 30px',
          WebkitMaskImage: 'linear-gradient(180deg, #000, transparent 70%)',
          maskImage: 'linear-gradient(180deg, #000, transparent 70%)',
        }}
      />

      <Skyline />

      {/* Language */}
      <div className="relative z-10 flex justify-end px-5 pt-4">
        <button
          type="button"
          onClick={() => setLocale(isFa ? 'en-US' : 'fa-IR')}
          className="rounded-full border border-[#1F4C9C] bg-[#0A1630]/70 px-3.5 py-1.5 text-xs font-semibold text-[#9BD0FF] backdrop-blur"
        >
          {isFa ? 'English' : 'فارسی'}
        </button>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[22vh] pt-2">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 pb-6 text-center">
          <BrandLogo glow className="h-40 w-40 shadow-[0_0_46px_6px_rgba(29,134,255,0.5)]" />
          <h1 className="text-[28px] font-extrabold tracking-wide text-white [text-shadow:0_0_18px_rgba(59,152,255,0.9)]" dir="ltr">
            ASiS VPN
          </h1>
          <p className="text-sm text-[#9DB6DC]">
            {isFa ? 'به دنیای آزاد متصل شوید' : 'Connect to the open world'}
          </p>
        </div>

        {err && (
          <div className="mb-3">
            <StatusBanner tone={authError?.category === 'backend_unavailable' ? 'warning' : 'error'} title={err.title} description={err.body} />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
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
                placeholder={t.usernameLabel}
                value={username}
                disabled={isLoading}
                error={usernameError}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (authError) setAuthError(null);
                }}
                className="!min-h-[52px] !rounded-2xl !border-[#23509C]/70 !bg-[#0D2349]/70 !text-base"
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
                placeholder={t.passwordLabel}
                value={password}
                disabled={isLoading}
                error={passwordError}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                className="!min-h-[52px] !rounded-2xl !border-[#23509C]/70 !bg-[#0D2349]/70 !text-base"
              />
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
              className="!min-h-[52px] !rounded-2xl !border-[#23509C]/70 !bg-[#0D2349]/70 !text-base"
            />
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className="!min-h-[54px] w-full !rounded-2xl !text-base !font-bold"
          >
            {isLoading ? t.submitSigningIn : isFa ? 'ورود' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'password' ? 'link' : 'password');
              setAuthError(null);
            }}
            className="font-medium text-[#5FB0FF]"
          >
            {mode === 'password'
              ? isFa ? 'ورود با لینک اشتراک' : 'Sign in with subscription link'
              : isFa ? 'ورود با نام کاربری و رمز' : 'Sign in with username'}
          </button>
          {mode === 'password' && (
            <button
              type="button"
              onClick={() => {
                setRecoveryUsername(username);
                setRecoveryError(null);
                setRecoveryNotice(null);
                setRecoveryOpen(true);
              }}
              className="text-[#9DB6DC]"
            >
              {isFa ? 'رمز عبور خود را فراموش کرده‌اید؟' : 'Forgot your password?'}
            </button>
          )}
          {mode === 'password' && SIGNUP_URL && (
            <button
              type="button"
              onClick={() => {
                if (SIGNUP_URL) window.open(SIGNUP_URL, '_blank', 'noopener,noreferrer');
              }}
              className="text-[#9DB6DC]"
            >
              {isFa ? 'ثبت‌نام در حساب کاربری' : 'Create an account'}
            </button>
          )}
          {onContinueWithoutAccount && (
            <button type="button" onClick={onContinueWithoutAccount} className="text-[#9DB6DC]">
              {isFa ? 'ادامه بدون حساب (افزودن دستی اشتراک)' : 'Continue without an account'}
            </button>
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
