import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearEndpointLinks } from '../engine/endpointLinks';
import {
  BarChart3,
  ChevronRight,
  Globe,
  Home,
  Layers,
  LifeBuoy,
  LogIn,
  MapPin,
  Settings,
  User,
} from 'lucide-react';
import { usePreferences } from '../design-system/ThemeContext';
import { tapHaptic } from './haptics';
import { BrandLogo, Button, SegmentedControl, ThemePaletteSwitcher } from '../design-system/components';
import {
  AsisVpnEngineAdapter,
  type AdvancedConnectionPolicy,
} from '../engine';
import {
  AsisLoginScreen,
  HttpAuthClient,
  getSecureStore,
  isAccessTokenExpiringSoon,
  loadPersistedSession,
  loadSessionSecure,
  persistSessionSecure,
  type AuthSession,
} from '../features/auth';
import { HomeView } from '../features/home/HomeView';
import {
  ServersView,
  type CustomServerEntry,
  type ProbeResultEntry,
  type ServerCatalogEntry,
  buildServerCatalogFromSubscriptions,
  probeFromPhone,
} from '../features/servers';
import { loadLastServerId, saveLastServerId } from '../features/home/autoConnect';
import {
  SubscriptionsView,
  fetchAccountSubscriptions,
  type SubscriptionRecord,
} from '../features/subscriptions';
import { LazyScreen } from './LazyScreen';

// Screens opened less often load on demand (the statistics screen brings the charts library with it).
const AccountView = lazy(() => import('../features/account/AccountView').then((m) => ({ default: m.AccountView })));
const SettingsView = lazy(() => import('../features/settings').then((m) => ({ default: m.SettingsView })));
const StatisticsView = lazy(() => import('../features/statistics').then((m) => ({ default: m.StatisticsView })));
const SupportView = lazy(() => import('../features/support/SupportView').then((m) => ({ default: m.SupportView })));
const GatewayStatusView = lazy(() =>
  import('../features/gateway/GatewayStatusView').then((m) => ({ default: m.GatewayStatusView })),
);

type ClientScreen =
  | 'home'
  | 'locations'
  | 'subscriptions'
  | 'statistics'
  | 'account'
  | 'settings'
  | 'support'
  | 'gateway';

const DEFAULT_POLICY: AdvancedConnectionPolicy = {
  killSwitch: false,
  splitTunnelingMode: 'bypass_lan',
  splitTunnelingRuleMode: 'exclude_selected',
  splitTunnelingAppIds: [],
  customDns: '1.1.1.1',
  ipv6Mode: 'auto',
  mtu: 1400,
  autoReconnect: true,
  autoSwitch: false,
  autoConnect: false,
  connectionTimeoutSec: 15,
  protocolPreference: 'auto',
  routingMode: 'rule',
  allowLocalNetwork: true,
  localSocksPort: 10808,
  localHttpPort: 10809,
};

const POLICY_STORAGE_KEY = 'asis_connection_policy_v1';

function loadStoredPolicy(): AdvancedConnectionPolicy {
  if (typeof window === 'undefined') return DEFAULT_POLICY;
  try {
    const raw = window.localStorage.getItem(POLICY_STORAGE_KEY);
    if (!raw) return DEFAULT_POLICY;
    const parsed = JSON.parse(raw) as Partial<AdvancedConnectionPolicy>;
    return {
      ...DEFAULT_POLICY,
      ...parsed,
      splitTunnelingRuleMode:
        parsed.splitTunnelingRuleMode === 'include_selected'
          ? 'include_selected'
          : 'exclude_selected',
      splitTunnelingAppIds: Array.isArray(parsed.splitTunnelingAppIds)
        ? parsed.splitTunnelingAppIds.filter((id): id is string => typeof id === 'string')
        : DEFAULT_POLICY.splitTunnelingAppIds,
      mtu:
        typeof parsed.mtu === 'number' && parsed.mtu >= 1280 && parsed.mtu <= 1500
          ? parsed.mtu
          : DEFAULT_POLICY.mtu,
      connectionTimeoutSec:
        typeof parsed.connectionTimeoutSec === 'number' &&
        parsed.connectionTimeoutSec >= 5 &&
        parsed.connectionTimeoutSec <= 60
          ? parsed.connectionTimeoutSec
          : DEFAULT_POLICY.connectionTimeoutSec,
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

const CUSTOM_LOCATIONS_STORAGE_KEY = 'asis_custom_locations_v1';

function loadStoredCustomServers(): CustomServerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_LOCATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CustomServerEntry[]) : [];
  } catch {
    return [];
  }
}

export function AsisClientShell() {
  const { locale, setLocale, dir } = usePreferences();
  const isFa = locale === 'fa-IR';

  const [screen, setScreenRaw] = useState<ClientScreen>('home');
  const screenRef = useRef<ClientScreen>('home');

  // Every in-app navigation is a history entry, so the Android back button
  // (and the browser back button) returns to the previous screen instead of
  // closing the app. Back from the first screen still exits.
  const setScreen = useCallback((next: ClientScreen) => {
    if (next === screenRef.current) return;
    screenRef.current = next;
    try {
      window.history.pushState({ asisScreen: next }, '');
    } catch {
      // History API unavailable: fall back to plain state navigation.
    }
    setScreenRaw(next);
    tapHaptic();
  }, []);

  useEffect(() => {
    try {
      window.history.replaceState({ asisScreen: 'home' }, '');
    } catch {
      // Ignore.
    }
    const onPop = (event: PopStateEvent) => {
      const stored = (event.state as { asisScreen?: ClientScreen } | null)?.asisScreen;
      const target: ClientScreen = stored ?? 'home';
      screenRef.current = target;
      setScreenRaw(target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // With a system secure store (plugin installed) the saved session loads asynchronously, so we
  // start signed-out + "restoring" and wait; without it the old synchronous load is used.
  const [sessionRestoring, setSessionRestoring] = useState<boolean>(() => getSecureStore() !== null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    getSecureStore() ? null : loadPersistedSession(),
  );
  // Without an account the person can still add subscription links by hand ("guest").
  const [guestMode, setGuestMode] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Installed app: load the saved session from the secure store (only when one exists).
  useEffect(() => {
    if (!sessionRestoring) return;
    let cancelled = false;
    void loadSessionSecure()
      .then((saved) => {
        if (!cancelled && saved) setAuthSession((prev) => prev ?? saved);
      })
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setSessionRestoring(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once on launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Installed app: keep the session across launches (browser preview never persists tokens).
  // Never save while restoring: the empty initial state would wipe the stored session.
  useEffect(() => {
    if (sessionRestoring) return;
    void persistSessionSecure(authSession);
  }, [authSession, sessionRestoring]);

  // On launch (after the saved session is loaded), renew an expired access token; if renewal
  // fails, send the person back to sign-in.
  useEffect(() => {
    if (sessionRestoring) return;
    if (!authSession || !isAccessTokenExpiringSoon(authSession)) return;
    let cancelled = false;
    void new HttpAuthClient('/api/v1')
      .refresh(authSession.tokens.refreshToken, authSession.deviceId)
      .then((tokens) => {
        if (!cancelled) setAuthSession((prev) => (prev ? { ...prev, tokens } : prev));
      })
      .catch(() => {
        if (cancelled) return;
        setSessionExpired(true);
        setAuthSession(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRestoring]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);

  // Account subscriptions (and their servers) load automatically after sign-in
  // and disappear on sign-out. Keyed by user + device, not by the rotating access token.
  const signedInUserId = authSession?.user.id ?? null;
  const signedInDeviceId = authSession?.deviceId ?? null;
  useEffect(() => {
    if (!signedInUserId) {
      clearEndpointLinks();
      setSubscriptions((prev) => (prev.some((s) => s.source === 'account') ? prev.filter((s) => s.source !== 'account') : prev));
      return;
    }
    const accessToken = authSession?.tokens.accessToken;
    if (!accessToken) return;
    let cancelled = false;
    void fetchAccountSubscriptions(accessToken).then((result) => {
      if (cancelled || !result.ok) return;
      setSubscriptions((prev) => [...result.subscriptions, ...prev.filter((s) => s.source !== 'account')]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInUserId, signedInDeviceId]);
  const [customServers, setCustomServers] = useState<CustomServerEntry[]>(() =>
    loadStoredCustomServers(),
  );
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerCatalogEntry | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, ProbeResultEntry>>({});
  const [probingIds, setProbingIds] = useState<Set<string>>(() => new Set());
  const [policy, setPolicy] = useState<AdvancedConnectionPolicy>(() => loadStoredPolicy());
  // Auto-connect is armed once per app launch and consumed by the first attempt or by any user action.
  const [autoConnectPending, setAutoConnectPending] = useState(true);

  const handleProbeServers = async (targets: ServerCatalogEntry[]) => {
    const validTargets = targets.filter(
      (srv) => srv.supported && typeof srv.probeHost === 'string' && srv.probeHost.length > 0 && srv.port,
    );
    if (validTargets.length === 0) return;

    const targetIds = validTargets.map((t) => t.id);
    setProbingIds((prev) => {
      const next = new Set(prev);
      for (const id of targetIds) next.add(id);
      return next;
    });

    try {
      // Inside the Android app, measure from the phone itself (the network that actually
      // has to reach the server); in a browser fall back to the gateway probe below.
      const phoneResults = await probeFromPhone(
        validTargets.map((t) => ({ id: t.id, host: t.probeHost as string, port: t.port ?? 443 })),
      );
      if (phoneResults) {
        const measuredAt = new Date().toISOString();
        setProbeResults((prev) => {
          const next = { ...prev };
          for (const item of phoneResults) {
            next[item.id] = {
              latencyMs: item.latencyMs,
              available: item.available,
              error: item.error,
              measuredAt,
              source: 'phone_tcp_probe',
            };
          }
          return next;
        });
        return;
      }

      for (let i = 0; i < validTargets.length; i += 15) {
        const chunk = validTargets.slice(i, i + 15);
        const res = await fetch('/api/v1/servers/probe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authSession?.tokens?.accessToken
              ? { Authorization: `Bearer ${authSession.tokens.accessToken}` }
              : {}),
          },
          body: JSON.stringify({
            targets: chunk.map((t) => ({
              id: t.id,
              host: t.probeHost,
              port: t.port ?? 443,
            })),
          }),
        });
        if (!res.ok) continue;
        const body = (await res.json()) as {
          measuredAt?: string;
          results?: Array<{
            id: string;
            latencyMs: number | null;
            available: boolean;
            error?: string;
          }>;
        };
        const measuredAt = body.measuredAt ?? new Date().toISOString();
        if (Array.isArray(body.results)) {
          setProbeResults((prev) => {
            const next = { ...prev };
            for (const item of body.results!) {
              next[item.id] = {
                latencyMs: item.latencyMs,
                available: item.available,
                error: item.error,
                measuredAt,
              };
            }
            return next;
          });
        }
      }
    } finally {
      setProbingIds((prev) => {
        const next = new Set(prev);
        for (const id of targetIds) next.delete(id);
        return next;
      });
    }
  };

  const hydratedSelectedServer = useMemo(() => {
    if (!selectedServer) return null;
    const probe = probeResults[selectedServer.id];
    if (!probe) return selectedServer;
    return {
      ...selectedServer,
      available: selectedServer.supported ? probe.available : false,
      probeLatencyMs: selectedServer.supported ? probe.latencyMs : null,
      measurementSource: selectedServer.supported
        ? (probe.source ?? ('gateway_tcp_probe' as const))
        : ('unsupported_protocol' as const),
    };
  }, [selectedServer, probeResults]);

  // Servers the core may switch between in auto mode: the selected server's subscription,
  // supported and not known-unreachable, best measured latency first (ping is the entry hop).
  const autoSwitchCandidates = useMemo(() => {
    if (!hydratedSelectedServer) return [];
    const catalog = buildServerCatalogFromSubscriptions(subscriptions, customServers, probeResults);
    return catalog
      .filter(
        (s) =>
          s.supported &&
          s.available !== false &&
          s.subscriptionId === hydratedSelectedServer.subscriptionId,
      )
      .sort((a, b) => (a.probeLatencyMs ?? Infinity) - (b.probeLatencyMs ?? Infinity));
  }, [hydratedSelectedServer, subscriptions, customServers, probeResults]);

  const handleAddCustomServers = (entries: CustomServerEntry[]) => {
    setCustomServers((prev) => {
      const next = [...entries, ...prev];
      try {
        window.localStorage.setItem(CUSTOM_LOCATIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleRemoveCustomServer = (serverId: string) => {
    setCustomServers((prev) => {
      const next = prev.filter((s) => s.id !== serverId);
      try {
        window.localStorage.setItem(CUSTOM_LOCATIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
    if (selectedServer?.id === serverId) {
      setSelectedServer(null);
    }
  };

  // Auto-connect only makes sense right after launch: disarm if the server list never becomes ready.
  useEffect(() => {
    const timer = setTimeout(() => setAutoConnectPending(false), 20000);
    return () => clearTimeout(timer);
  }, []);

  // Remember the last chosen server so auto-connect can pick it again after a restart.
  useEffect(() => {
    if (selectedServer) saveLastServerId(selectedServer.id);
  }, [selectedServer?.id]);

  // Cold start: re-select the last used server as soon as the catalog has it (account sync is async).
  useEffect(() => {
    if (!policy.autoConnect || !autoConnectPending || selectedServer) return;
    const lastId = loadLastServerId();
    if (!lastId) return;
    const found = buildServerCatalogFromSubscriptions(subscriptions, customServers, probeResults).find(
      (s) => s.id === lastId && s.supported,
    );
    if (found) setSelectedServer(found);
  }, [policy.autoConnect, autoConnectPending, selectedServer, subscriptions, customServers, probeResults]);

  const handlePolicyChange = (next: AdvancedConnectionPolicy) => {
    setPolicy(next);
    try {
      window.localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const engine = useMemo(() => new AsisVpnEngineAdapter(), []);

  const activeSubscription = useMemo(
    () => subscriptions.find((s) => s.id === activeSubscriptionId) ?? subscriptions[0] ?? null,
    [subscriptions, activeSubscriptionId],
  );

  const primaryNav: Array<{
    id: ClientScreen;
    labelEn: string;
    labelFa: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', labelEn: 'Home', labelFa: 'خانه', icon: Home },
    { id: 'locations', labelEn: 'Locations', labelFa: 'سرورها', icon: MapPin },
    { id: 'subscriptions', labelEn: 'Subscriptions', labelFa: 'اشتراک‌ها', icon: Layers },
    { id: 'statistics', labelEn: 'Statistics', labelFa: 'آمار', icon: BarChart3 },
  ];

  const secondaryNav: Array<{
    id: ClientScreen;
    labelEn: string;
    labelFa: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'account', labelEn: 'Account', labelFa: 'حساب کاربری', icon: User },
    { id: 'settings', labelEn: 'Settings', labelFa: 'تنظیمات', icon: Settings },
    { id: 'support', labelEn: 'Support', labelFa: 'پشتیبانی', icon: LifeBuoy },
  ];

  const allNav = [...primaryNav, ...secondaryNav];
  // Phone bottom bar follows the design: Home, Servers, Stats, Account, Settings.
  const MOBILE_NAV_IDS: ClientScreen[] = ['home', 'locations', 'statistics', 'account', 'settings'];
  const mobileNav = MOBILE_NAV_IDS.map((id) => allNav.find((n) => n.id === id)!).filter(Boolean);
  const currentNav = allNav.find((n) => n.id === screen) ?? primaryNav[0];

  const renderNavButton = (item: (typeof allNav)[number]) => {
    const Icon = item.icon;
    const active = screen === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setScreen(item.id)}
        className={`group relative flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
          active
            ? 'border-[var(--asis-primary-border)] bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'border-transparent text-[var(--asis-text-secondary)] hover:translate-x-0.5 rtl:hover:-translate-x-0.5 hover:bg-[var(--asis-surface-2)] hover:text-[var(--asis-text-primary)]'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
        <span>{isFa ? item.labelFa : item.labelEn}</span>
      </button>
    );
  };

  if (sessionRestoring) {
    // Short blank screen while the saved session loads, so the sign-in form does not flash.
    return <div className="min-h-screen" aria-busy="true" />;
  }

  if (!authSession && !guestMode) {
    return (
      <AsisLoginScreen
        initialSessionExpired={sessionExpired}
        onAuthenticated={(session) => {
          setSessionExpired(false);
          screenRef.current = 'home';
          setScreenRaw('home');
          setAuthSession(session);
        }}
        onContinueWithoutAccount={() => {
          setGuestMode(true);
          setScreen('subscriptions');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--asis-bg)] text-[var(--asis-text-primary)] transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-[260px] md:flex-col md:shrink-0 border-e border-[var(--asis-border)] bg-[var(--asis-chrome)]">
        <div className="flex items-center gap-3 border-b border-[var(--asis-border)] px-5 py-4.5">
          <BrandLogo className="w-8 h-8 shrink-0 transition-transform duration-200 hover:scale-105" />
          <div className="text-start">
            <span className="block text-base font-bold tracking-tight">ASiS VPN</span>
            <span className="block text-[11px] text-[var(--asis-text-secondary)]">
              {isFa ? 'کلاینت امن چندپلتفرمی' : 'Secure Client'}
            </span>
          </div>
        </div>

        <nav aria-label="ASiS VPN Navigation" className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <div className="space-y-1">
            <p className="px-3.5 pb-1 text-xs font-medium text-[var(--asis-text-secondary)] text-start">
              {isFa ? 'اتصال و شبکه' : 'Connection'}
            </p>
            {primaryNav.map(renderNavButton)}
          </div>

          <div className="space-y-1">
            <p className="px-3.5 pb-1 text-xs font-medium text-[var(--asis-text-secondary)] text-start">
              {isFa ? 'حساب و سامانه' : 'Account & System'}
            </p>
            {secondaryNav.map(renderNavButton)}
          </div>
        </nav>

        <div className="border-t border-[var(--asis-border)] p-4">
          <button
            type="button"
            onClick={() => setScreen('account')}
            className="group flex w-full items-center justify-between gap-2 rounded-xl bg-[var(--asis-surface)] border border-[var(--asis-border)] px-3.5 py-3 text-start transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--asis-primary-border)] hover:bg-[var(--asis-primary-soft)]/50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)] transition-transform duration-150 group-hover:scale-105">
                <User className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">
                  {authSession
                    ? authSession.user.username
                    : isFa
                      ? 'ورود به حساب کاربری'
                      : 'Sign in to account'}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--asis-text-secondary)] truncate">
                  {subscriptions.length > 0
                    ? isFa
                      ? `${subscriptions.length} اشتراک فعال`
                      : `${subscriptions.length} ${subscriptions.length === 1 ? 'subscription' : 'subscriptions'}`
                    : isFa
                      ? 'همگام‌سازی و مدیریت دستگاه‌ها'
                      : 'Sync & device sessions'}
                </p>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 shrink-0 text-[var(--asis-text-secondary)] transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${
                dir === 'rtl' ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="asis-canvas-ambient flex flex-1 flex-col min-w-0 pb-24 md:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 hidden md:flex items-center justify-between gap-4 border-b border-[var(--asis-border)] bg-[var(--asis-chrome)]/85 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo glow className="w-7 h-7 md:hidden shrink-0" />
            <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
              <currentNav.icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <h1 className="text-base font-semibold tracking-tight truncate">
              {isFa ? currentNav.labelFa : currentNav.labelEn}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {!authSession && screen !== 'account' && (
              <Button
                variant="primary"
                size="sm"
                icon={<LogIn className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => setScreen('account')}
              >
                {isFa ? 'ورود' : 'Sign In'}
              </Button>
            )}

            <SegmentedControl<'en-US' | 'fa-IR'>
              ariaLabel="Language"
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'en-US', label: 'EN' },
                { value: 'fa-IR', label: 'FA' },
              ]}
            />
          </div>
        </header>

        {screen !== 'home' && (
          <div className="flex items-center justify-center px-4 pb-1 pt-4 md:hidden">
            <h1 className="text-lg font-bold tracking-tight">{isFa ? currentNav.labelFa : currentNav.labelEn}</h1>
          </div>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 sm:px-8 sm:py-9 md:py-9">
          <div key={screen} className="asis-view-enter">
            {screen === 'home' && (
              <HomeView
                engine={engine}
                policy={policy}
                activeSubscription={activeSubscription}
                selectedServer={hydratedSelectedServer}
                autoSwitchCandidates={autoSwitchCandidates}
                autoConnectPending={policy.autoConnect === true && autoConnectPending}
                onAutoConnectHandled={() => setAutoConnectPending(false)}
                probingSelectedServer={
                  hydratedSelectedServer ? probingIds.has(hydratedSelectedServer.id) : false
                }
                onProbeSelectedServer={(srv) => void handleProbeServers([srv])}
                onNavigate={(target) => setScreen(target)}
              />
            )}

            {screen === 'locations' && (
              <ServersView
                session={authSession}
                subscriptions={subscriptions}
                customServers={customServers}
                probeResults={probeResults}
                probingIds={probingIds}
                onProbeServers={(targets) => void handleProbeServers(targets)}
                onAddCustomServers={handleAddCustomServers}
                onRemoveCustomServer={handleRemoveCustomServer}
                selectedServerId={selectedServer?.id ?? null}
                onSelectServer={(srv) => {
                  setAutoConnectPending(false);
                  setSelectedServer(srv);
                  if (srv.probeLatencyMs === null && srv.probeHost && srv.port) {
                    void handleProbeServers([srv]);
                  }
                  setScreen('home');
                }}
                onNavigateToSubscriptions={() => setScreen('subscriptions')}
              />
            )}

            {screen === 'subscriptions' && (
              <SubscriptionsView
                session={authSession}
                subscriptions={subscriptions}
                onSubscriptionsChange={setSubscriptions}
                activeSubscriptionId={activeSubscription?.id ?? null}
                onSelectSubscription={(sub) => setActiveSubscriptionId(sub.id)}
              />
            )}

            <LazyScreen screen={screen}>
              {screen === 'statistics' && (
                <StatisticsView
                  session={authSession}
                  activeSubscription={activeSubscription}
                  engineStats={engine.getConnectionStatistics()}
                />
              )}

              {screen === 'account' && (
                <AccountView
                  session={authSession}
                  onSessionChange={(next) => {
                    if (!next) setGuestMode(false);
                    setAuthSession(next);
                  }}
                  onNavigateToSubscriptions={() => setScreen('subscriptions')}
                  onNavigateToSupport={() => setScreen('support')}
                  onNavigateToGateway={() => setScreen('gateway')}
                  subscriptionCount={subscriptions.length}
                />
              )}

              {screen === 'settings' && (
                <SettingsView
                  platform={engine.platform}
                  policy={policy}
                  onPolicyChange={handlePolicyChange}
                  loadInstalledApplications={() => engine.getInstalledApplications()}
                  onNavigateToSupport={() => setScreen('support')}
                />
              )}

              {screen === 'support' && (
                <SupportView
                  engine={engine}
                  session={authSession}
                  activeSubscription={activeSubscription}
                  selectedServer={selectedServer}
                />
              )}

              {screen === 'gateway' && <GatewayStatusView />}
            </LazyScreen>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="asis-glass fixed bottom-0 inset-x-0 z-40 flex md:hidden items-stretch justify-around rounded-t-3xl border-t border-[var(--asis-primary-border)] bg-[var(--asis-chrome)]/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-12px_rgba(var(--asis-glow-rgb),0.45)] backdrop-blur-xl"
      >
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setScreen(item.id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
                active
                  ? 'text-[var(--asis-accent-fg)] asis-neon-text'
                  : 'text-[var(--asis-text-secondary)]'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  active ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--asis-glow-rgb),0.9)]' : ''
                }`}
                aria-hidden="true"
              />
              <span className="truncate max-w-[64px]">{isFa ? item.labelFa : item.labelEn}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 h-0.5 w-8 rounded-full bg-[var(--asis-primary)] shadow-[0_0_10px_rgba(var(--asis-glow-rgb),0.9)]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
