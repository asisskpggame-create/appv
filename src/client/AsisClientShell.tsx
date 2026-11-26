import React, { useMemo, useState } from 'react';
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
import { BrandLogo, Button, SegmentedControl, ThemePaletteSwitcher } from '../design-system/components';
import {
  AsisVpnEngineAdapter,
  type AdvancedConnectionPolicy,
} from '../engine';
import type { AuthSession } from '../features/auth';
import { AccountView } from '../features/account/AccountView';
import { HomeView } from '../features/home/HomeView';
import {
  ServersView,
  type CustomServerEntry,
  type ProbeResultEntry,
  type ServerCatalogEntry,
} from '../features/servers';
import { SettingsView } from '../features/settings';
import { StatisticsView } from '../features/statistics';
import { SubscriptionsView, type SubscriptionRecord } from '../features/subscriptions';
import { SupportView } from '../features/support/SupportView';
import { GatewayStatusView } from '../features/gateway/GatewayStatusView';

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

  const [screen, setScreen] = useState<ClientScreen>('home');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [customServers, setCustomServers] = useState<CustomServerEntry[]>(() =>
    loadStoredCustomServers(),
  );
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerCatalogEntry | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, ProbeResultEntry>>({});
  const [probingIds, setProbingIds] = useState<Set<string>>(() => new Set());
  const [policy, setPolicy] = useState<AdvancedConnectionPolicy>(() => loadStoredPolicy());

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
      for (let i = 0; i < validTargets.length; i += 15) {
        const chunk = validTargets.slice(i, i + 15);
        const res = await fetch('/api/v1/servers/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
      measurementSource: selectedServer.supported ? ('gateway_tcp_probe' as const) : ('unsupported_protocol' as const),
    };
  }, [selectedServer, probeResults]);

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
    { id: 'locations', labelEn: 'Locations', labelFa: 'مکان‌ها', icon: MapPin },
    { id: 'subscriptions', labelEn: 'Subscriptions', labelFa: 'اشتراک‌ها', icon: Layers },
    { id: 'statistics', labelEn: 'Statistics', labelFa: 'آمار و پروتکل', icon: BarChart3 },
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
    { id: 'gateway', labelEn: 'API Gateway', labelFa: 'درگاه API', icon: Globe },
  ];

  const allNav = [...primaryNav, ...secondaryNav];
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
      <div className="asis-canvas-ambient flex flex-1 flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--asis-border)] bg-[var(--asis-chrome)]/85 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo className="w-6 h-6 md:hidden shrink-0" />
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

            <ThemePaletteSwitcher variant="popover" />

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

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-8 sm:py-9">
          <div key={screen} className="asis-view-enter">
            {screen === 'home' && (
              <HomeView
                engine={engine}
                policy={policy}
                activeSubscription={activeSubscription}
                selectedServer={hydratedSelectedServer}
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
                onSessionChange={setAuthSession}
                onNavigateToSubscriptions={() => setScreen('subscriptions')}
              />
            )}

            {screen === 'settings' && (
              <SettingsView
                platform={engine.platform}
                policy={policy}
                onPolicyChange={handlePolicyChange}
                loadInstalledApplications={() => engine.getInstalledApplications()}
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
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 flex md:hidden items-center justify-around border-t border-[var(--asis-border)] bg-[var(--asis-chrome)]/95 px-1 py-1.5 backdrop-blur-md"
      >
        {allNav.slice(0, 6).map((item) => {
          const Icon = item.icon;
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setScreen(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium cursor-pointer ${
                active
                  ? 'text-[var(--asis-accent-fg)]'
                  : 'text-[var(--asis-text-secondary)]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="truncate max-w-[54px]">{isFa ? item.labelFa : item.labelEn}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
