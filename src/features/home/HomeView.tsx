import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Globe,
  Layers,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sliders,
  Stethoscope,
  Wifi,
} from 'lucide-react';
import { ConnectionButton } from './ConnectionButton';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  Button,
  Card,
  CountryFlag,
  LatencyIndicator,
  StatusBanner,
} from '../../design-system/components';
import type {
  AdvancedConnectionPolicy,
  ConnectionState,
  SanitizedOutboundConfig,
  TunnelStatus,
  VpnEngineAdapter,
} from '../../engine';
import { getEndpointLink, validateAndParseOutbound } from '../../engine';
import { resolveCountryByCode, type ServerCatalogEntry } from '../servers';
import type { SubscriptionRecord } from '../subscriptions';
import { formatBytesCompact } from '../subscriptions';
import { evaluateExit, fetchExitInfo, type ExitInfo } from './exitCheck';
import {
  decideAutoConnect,
  hasVpnConsent,
  markVpnConsentGranted,
  nativeTunnelAlreadyActive,
  readNativeState,
} from './autoConnect';

interface HomeViewProps {
  engine: VpnEngineAdapter;
  policy: AdvancedConnectionPolicy;
  activeSubscription: SubscriptionRecord | null;
  selectedServer: ServerCatalogEntry | null;
  /** Servers the core may switch between when policy.autoSwitch is on (best first). */
  autoSwitchCandidates?: ServerCatalogEntry[];
  /** Armed for this app launch: connect to the selected server once it is ready (policy.autoConnect). */
  autoConnectPending?: boolean;
  onAutoConnectHandled?: () => void;
  probingSelectedServer?: boolean;
  onProbeSelectedServer?: (server: ServerCatalogEntry) => void;
  onNavigate: (view: 'locations' | 'subscriptions' | 'support' | 'settings') => void;
}

function formatDuration(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export function HomeView({
  engine,
  policy,
  activeSubscription,
  selectedServer,
  autoSwitchCandidates = [],
  autoConnectPending = false,
  onAutoConnectHandled,
  probingSelectedServer = false,
  onProbeSelectedServer,
  onNavigate,
}: HomeViewProps) {
  const { locale, dir } = usePreferences();
  const isFa = locale === 'fa-IR';

  const [connState, setConnState] = useState<ConnectionState>(() => engine.getConnectionState());
  const [engineError, setEngineError] = useState<{ code: string; message: string } | null>(null);
  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const exitRequestId = useRef(0);
  // Servers inside the running auto-switch group, in the order the core knows them (node-0, node-1, ...).
  const [groupServers, setGroupServers] = useState<ServerCatalogEntry[] | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);

  const stats = engine.getConnectionStatistics();

  // Always reads the address the internet currently sees. Stale answers (from before a
  // connect/disconnect) are dropped via the request counter.
  const refreshExit = async (attempts = 1) => {
    const requestId = ++exitRequestId.current;
    setIpLoading(true);
    let result: ExitInfo | null = null;
    for (let i = 0; i < attempts && !result; i += 1) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500));
      if (requestId !== exitRequestId.current) return;
      result = await fetchExitInfo();
    }
    if (requestId !== exitRequestId.current) return;
    setExitInfo(result);
    setIpLoading(false);
  };

  useEffect(() => {
    if (connState === 'Connected') {
      // Give the tunnel a moment to carry traffic, then retry a few times if it is slow.
      setExitInfo(null);
      const timer = setTimeout(() => void refreshExit(3), 1200);
      return () => clearTimeout(timer);
    }
    if (connState === 'Disconnected') {
      void refreshExit(1);
      return;
    }
    // Preparing / Connecting / Reconnecting / Disconnecting: any shown IP would be stale.
    exitRequestId.current += 1;
    setExitInfo(null);
    setIpLoading(false);
  }, [connState]);

  // The native tunnel can outlive the web view: on mount, show what it is really doing.
  useEffect(() => {
    let cancelled = false;
    void readNativeState().then((state) => {
      if (cancelled || !state) return;
      if (state === 'Connected' || state === 'Connecting' || state === 'Reconnecting') setConnState(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A real Connected state proves the OS VPN permission is granted: from now on auto-connect may run.
  useEffect(() => {
    if (connState === 'Connected') markVpnConsentGranted();
  }, [connState]);

  // Auto-connect on app open: decided by the pure rules in autoConnect.ts; runs at most once per launch.
  useEffect(() => {
    if (!autoConnectPending) return;
    const decision = decideAutoConnect({
      enabled: true,
      pending: true,
      connState,
      hasConsent: hasVpnConsent(),
      nativeAvailable: engine.getDiagnostics().nativeBridgeAvailable,
      serverResolved: Boolean(selectedServer),
      hasLink: selectedServer ? getEndpointLink(selectedServer.id) !== null : false,
    });
    if (decision === 'wait') return;
    onAutoConnectHandled?.();
    if (decision !== 'connect') return;
    void (async () => {
      if (await nativeTunnelAlreadyActive()) return;
      await handleToggleConnection(true);
    })();
  }, [autoConnectPending, connState, selectedServer?.id]);

  // Real tunnel latency (through the tunnel, end to end) and, in auto mode, which server is active.
  useEffect(() => {
    if (connState !== 'Connected' || !engine.getTunnelStatus) {
      setTunnelStatus(null);
      if (connState === 'Disconnected') setGroupServers(null);
      return;
    }
    let cancelled = false;
    const poll = async (forceTest: boolean) => {
      try {
        const next =
          forceTest && engine.runTunnelTest ? await engine.runTunnelTest() : await engine.getTunnelStatus!();
        if (!cancelled) setTunnelStatus(next);
      } catch {
        if (!cancelled) setTunnelStatus(null);
      }
    };
    const first = setTimeout(() => void poll(true), 2500);
    const timer = setInterval(() => void poll(false), 8000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [connState]);

  const activeTag = tunnelStatus?.available ? tunnelStatus.active : null;
  const activeNode = activeTag ? /^node-(\d+)$/.exec(activeTag) : null;
  const activeServer =
    groupServers && activeNode ? (groupServers[Number(activeNode[1])] ?? null) : null;
  // What the tunnel really exits through: in auto mode the server the core currently uses.
  const shownServer = connState === 'Connected' && groupServers ? (activeServer ?? selectedServer) : selectedServer;
  const tunnelRttMs = activeTag ? (tunnelStatus?.delays[activeTag] ?? null) : null;

  // The core may switch servers on its own: re-read the exit IP when the active server changes.
  useEffect(() => {
    if (connState === 'Connected' && groupServers && activeTag) void refreshExit(2);
  }, [activeTag]);

  const exitStatus = connState === 'Connected' ? evaluateExit(shownServer, exitInfo) : 'unknown';

  const stateLabel = (state: ConnectionState): string => {
    if (!isFa) return state;
    switch (state) {
      case 'Disconnected':
        return 'آماده اتصال';
      case 'Preparing':
        return 'در حال آماده‌سازی';
      case 'Connecting':
        return 'در حال اتصال';
      case 'Connected':
        return 'متصل و ایمن';
      case 'Reconnecting':
        return 'تلاش مجدد اتصال';
      case 'Disconnecting':
        return 'در حال قطع اتصال';
      case 'Error':
        return 'نیازمند برنامه بومی';
    }
  };

  const handleToggleConnection = async (auto = false) => {
    if (!auto) onAutoConnectHandled?.();
    setEngineError(null);

    if (connState === 'Connected' || connState === 'Connecting' || connState === 'Reconnecting') {
      await engine.disconnect();
      setConnState(engine.getConnectionState());
      return;
    }

    if (!selectedServer) {
      onNavigate('locations');
      return;
    }

    // The catalog only holds a redacted host. The real link (with UUID/password) comes
    // from the in-memory store filled during sync/import.
    const link = getEndpointLink(selectedServer.id);
    const parsed = link ? validateAndParseOutbound(link, engine.platform) : null;
    if (!parsed?.valid || !parsed.outbound) {
      setConnState(engine.getConnectionState());
      setEngineError(
        !link
          ? {
              code: 'ENGINE_NO_CONFIG',
              message: isFa
                ? 'پیکربندی کامل این سرور در دسترس نیست. اشتراک را دوباره همگام‌سازی یا وارد کنید.'
                : 'The full configuration for this server is not available. Sync or import the subscription again.',
            }
          : {
              code: 'ENGINE_INVALID_CONFIG',
              message: parsed?.errors[0] ?? 'This server link could not be used.',
            },
      );
      return;
    }
    setConnState('Preparing');
    const outbound: SanitizedOutboundConfig = parsed.outbound;

    // Auto-switch: the selected server first, then other usable servers of the same subscription.
    const members: Array<{ server: ServerCatalogEntry; outbound: SanitizedOutboundConfig }> = [
      { server: selectedServer, outbound },
    ];
    if (policy.autoSwitch === true && engine.connectGroup) {
      for (const cand of autoSwitchCandidates) {
        if (members.length >= 12) break;
        if (cand.id === selectedServer.id) continue;
        const candLink = getEndpointLink(cand.id);
        const candParsed = candLink ? validateAndParseOutbound(candLink, engine.platform) : null;
        if (candParsed?.valid && candParsed.outbound) {
          members.push({ server: cand, outbound: candParsed.outbound });
        }
      }
    }
    const useGroup = members.length >= 2 && Boolean(engine.connectGroup);

    try {
      if (useGroup) {
        await engine.connectGroup!(members.map((m) => m.outbound), policy);
        setGroupServers(members.map((m) => m.server));
      } else {
        await engine.connect(outbound, policy);
        setGroupServers(null);
      }
      setConnState(engine.getConnectionState());
    } catch (err) {
      setConnState(engine.getConnectionState());
      const diag = engine.getDiagnostics();
      setEngineError({
        code: diag.lastErrorCode ?? 'ENGINE_ERROR',
        message:
          err instanceof Error
            ? err.message
            : diag.lastErrorMessage ?? 'Connection could not be established.',
      });
    }
  };

  const isConnected = connState === 'Connected';

  return (
    <div className="space-y-6 text-start">
      {/* Primary Connection Console */}
      <Card elevated padding="none" className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left: Precision Calibrated Connection Dial */}
          <div className="asis-hero relative overflow-hidden lg:col-span-5 flex flex-col items-center justify-center bg-[var(--asis-chrome)] px-6 py-10 text-center border-b lg:border-b-0 lg:border-e border-[var(--asis-border)]">
            <div aria-hidden="true" className="asis-hero-map pointer-events-none absolute inset-0" />
            <div className="relative z-10 flex flex-col items-center">
            <ConnectionButton
              connState={connState}
              hasSelectedServer={Boolean(selectedServer)}
              isFa={isFa}
              onToggle={() => void handleToggleConnection()}
            />

            <div className="mt-5 space-y-2">
              <div
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  isConnected
                    ? 'border-[#16A34A]/50 bg-[#16A34A]/15 text-[#4ADE80] shadow-[0_0_18px_-4px_rgba(34,197,94,0.6)]'
                    : connState === 'Error'
                      ? 'border-[#DC2626]/50 bg-[#DC2626]/10 text-[#F87171]'
                      : 'border-[var(--asis-border-strong)] bg-[var(--asis-surface-2)] text-[var(--asis-text-secondary)]'
                }`}
              >
                {isConnected ? (
                  <Shield className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{stateLabel(connState)}</span>
              </div>
              <p className="font-mono text-xl font-semibold tracking-tight text-[var(--asis-text-primary)]">
                {formatDuration(stats.sessionDurationSec)}
              </p>
            </div>
            </div>
          </div>

          {/* Right: Hairline Telemetry & Routing Controls */}
          <div className="lg:col-span-7 flex flex-col justify-between divide-y divide-[var(--asis-border)]">
            {engineError && (
              <div className="p-6">
                <StatusBanner
                  tone="warning"
                  title={engineError.code}
                  description={
                    isFa
                      ? 'برقراری تونل شبکه در مرورگر پشتیبانی نمی‌شود و در نسخه بومی اندروید، iOS یا ویندوز اجرا خواهد شد. پیکربندی انتخابی اعتبارسنجی شد.'
                      : engineError.message
                  }
                />
              </div>
            )}

            {isConnected && (exitStatus === 'leak' || exitStatus === 'mismatch') && exitInfo && (
              <div className="p-6">
                <StatusBanner
                  tone={exitStatus === 'leak' ? 'error' : 'warning'}
                  title={
                    exitStatus === 'leak'
                      ? isFa
                        ? 'IP خروجی ایران است؛ ترافیک از تانل عبور نمی‌کند'
                        : 'Exit IP is Iranian: traffic is not going through the tunnel'
                      : isFa
                        ? `کشور خروجی واقعی (${exitInfo.countryCode}) با سرور انتخاب‌شده (${selectedServer?.countryCode}) فرق دارد`
                        : `Actual exit country (${exitInfo.countryCode}) differs from the selected server (${selectedServer?.countryCode})`
                  }
                  description={
                    exitStatus === 'leak'
                      ? isFa
                        ? 'سرور خروجی تانل یا مسیر ایران به خارج را بررسی کنید. اگر اپ در اسپلیت‌تانلینگ مستثنی شده، این چک هم از تانل نمی‌رود.'
                        : 'Check the tunnel\'s foreign exit and the Iran-to-abroad link. If this app is excluded in split tunneling, this check also bypasses the tunnel.'
                      : isFa
                        ? 'اگر سرور تانلی است، تگ [TUN ورودی>خروجی] اسم سرور را با کشور واقعی خروجی هماهنگ کنید.'
                        : 'For a tunnel server, make the [TUN entry>exit] tag in its name match the real exit country.'
                  }
                />
              </div>
            )}

            {/* Selected Server Selector */}
            <button
              type="button"
              onClick={() => onNavigate('locations')}
              className="group w-full flex items-center justify-between gap-4 px-6 py-5 text-start transition-colors duration-150 hover:bg-[var(--asis-surface-2)]/70 cursor-pointer"
            >
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--asis-text-secondary)]">
                  <Radio className="w-3.5 h-3.5 text-[var(--asis-accent-fg)]" aria-hidden="true" />
                  <span>{isFa ? 'مسیر و سرور انتخاب‌شده' : 'Selected Tunnel Route'}</span>
                </p>
                <p className="text-base font-semibold truncate flex items-center gap-2.5">
                  {selectedServer ? (
                    <>
                      <CountryFlag
                        code={selectedServer.countryCode}
                        emoji={selectedServer.countryFlag}
                      />
                      <span className="truncate">{selectedServer.name}</span>
                      {selectedServer.route === 'tunnel' && (
                        <span className="shrink-0 rounded-md border border-[var(--asis-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--asis-accent-fg)]">
                          {isFa ? 'تانل' : 'Tunnel'}
                        </span>
                      )}
                    </>
                  ) : isFa ? (
                    'انتخاب لوکیشن از فهرست سرورها'
                  ) : (
                    'Choose a server location'
                  )}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-[#5B6B84] dark:text-[#9BB0CE]">
                  {selectedServer ? (
                    <>
                      <span>{selectedServer.protocol}</span>
                      <span aria-hidden="true">·</span>
                      <LatencyIndicator
                        latencyMs={selectedServer.probeLatencyMs}
                        available={selectedServer.available}
                        probing={probingSelectedServer}
                        isFa={isFa}
                      />
                    </>
                  ) : (
                    <span>
                      {isFa
                        ? 'برای مشاهده سرورهای موجود کلیک کنید'
                        : 'Select an active subscription or endpoint to connect'}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight
                className={`w-5 h-5 text-[#5B6B84] transition-transform duration-150 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 dark:text-[#9BB0CE] shrink-0 ${
                  dir === 'rtl' ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Public IP, Server Ping & Exit Country Split */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-[var(--asis-border)]">
              <div className="px-6 py-5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {isConnected
                      ? isFa
                        ? 'IP خروجی (دیده‌شده در اینترنت)'
                        : 'Exit IP (as seen online)'
                      : isFa
                        ? 'IP عمومی شبکه'
                        : 'Current Public IP'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void refreshExit(1)}
                    disabled={ipLoading}
                    aria-label={isFa ? 'بروزرسانی IP' : 'Refresh public IP'}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#087BFF] hover:text-[#1684FF] dark:text-[#60A5FA] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ipLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="font-mono text-sm font-semibold flex items-center gap-2">
                  <span>
                    {exitInfo?.ip ??
                      (ipLoading
                        ? isFa
                          ? 'در حال بررسی…'
                          : 'Checking…'
                        : isFa
                          ? 'ناموجود'
                          : 'Unavailable')}
                  </span>
                  {exitInfo?.countryCode && (
                    <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      {exitInfo.countryCode}
                    </span>
                  )}
                </p>
              </div>

              <div className="px-6 py-5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {isFa ? 'پینگ سرور' : 'Server Ping'}
                  </span>
                  {selectedServer?.probeHost && selectedServer.port && onProbeSelectedServer && (
                    <button
                      type="button"
                      onClick={() => onProbeSelectedServer(selectedServer)}
                      disabled={probingSelectedServer}
                      aria-label={isFa ? 'تست مجدد پینگ' : 'Measure server ping'}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#087BFF] hover:text-[#1684FF] dark:text-[#60A5FA] cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${probingSelectedServer ? 'animate-spin' : ''}`}
                      />
                    </button>
                  )}
                </div>
                <div className="pt-0.5">
                  {selectedServer ? (
                    <LatencyIndicator
                      latencyMs={selectedServer.probeLatencyMs}
                      available={selectedServer.available}
                      probing={probingSelectedServer}
                      isFa={isFa}
                    />
                  ) : (
                    <span className="font-mono text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      --
                    </span>
                  )}
                </div>
                {isConnected && tunnelStatus?.available && (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {isFa ? 'تأخیر تانل' : 'Tunnel latency'}:{' '}
                    <span className="font-mono font-semibold text-[var(--asis-text-primary)]">
                      {tunnelRttMs != null ? `${tunnelRttMs} ms` : isFa ? 'نامشخص' : 'n/a'}
                    </span>
                  </p>
                )}
              </div>

              <div className="px-6 py-5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isFa ? 'کشور خروجی تونل' : 'Exit Region'}</span>
                </div>
                <p className="text-sm font-semibold truncate flex items-center gap-2">
                  {shownServer?.countryCode || shownServer?.countryName ? (
                    <>
                      <CountryFlag
                        code={shownServer.countryCode}
                        emoji={shownServer.countryFlag}
                      />
                      <span className="truncate">
                        {isFa
                          ? (resolveCountryByCode(shownServer.countryCode)?.nameFa ??
                            shownServer.countryName ??
                            shownServer.countryCode)
                          : (resolveCountryByCode(shownServer.countryCode)?.nameEn ??
                            shownServer.countryName ??
                            shownServer.countryCode)}
                      </span>
                    </>
                  ) : isFa ? (
                    'انتخاب نشده'
                  ) : (
                    'Not selected'
                  )}
                </p>
                {isConnected && exitStatus === 'ok' && (
                  <p className="text-xs text-[#16A34A] dark:text-[#4ADE80]">
                    {isFa ? 'تأیید شد با IP واقعی' : 'Verified from the live exit IP'}
                  </p>
                )}
                {isConnected && groupServers && (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {isFa ? 'اتوسوییچ فعال' : 'Auto-switch'}
                    {activeServer ? `: ${activeServer.name}` : ''}
                  </p>
                )}
                {shownServer?.route === 'tunnel' && (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {isFa
                      ? `از طریق ورودی ${
                          resolveCountryByCode(shownServer.entryCountryCode)?.nameFa ??
                          shownServer.entryCountryCode ??
                          'IR'
                        }`
                      : `via ${
                          resolveCountryByCode(shownServer.entryCountryCode)?.nameEn ??
                          shownServer.entryCountryCode ??
                          'IR'
                        } entry`}
                  </p>
                )}
              </div>
            </div>

            {/* Active Subscription & Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  {isFa ? 'اشتراک فعال' : 'Active Subscription'}
                </p>
                <p className="mt-0.5 text-sm font-semibold truncate">
                  {activeSubscription
                    ? `${activeSubscription.name} · ${activeSubscription.endpoints.length} ${
                        isFa ? 'سرور' : 'nodes'
                      }`
                    : isFa
                      ? 'هیچ اشتراکی انتخاب نشده است'
                      : 'No subscription active'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Layers className="w-3.5 h-3.5" aria-hidden="true" />}
                  onClick={() => onNavigate('subscriptions')}
                >
                  {isFa ? 'مدیریت اشتراک' : 'Subscriptions'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Stethoscope className="w-3.5 h-3.5" aria-hidden="true" />}
                  onClick={() => onNavigate('support')}
                >
                  {isFa ? 'عیب‌یابی' : 'Diagnostics'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 4-Column Session & Policy Telemetry Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card interactive padding="sm" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--asis-text-secondary)]">
            <span>{isFa ? 'سرعت دانلود' : 'Download'}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)] transition-transform duration-150 group-hover:scale-110">
              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono text-base font-semibold">
            {stats.downloadSpeedBps !== null ? `${stats.downloadSpeedBps} B/s` : '--'}
          </p>
        </Card>

        <Card interactive padding="sm" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--asis-text-secondary)]">
            <span>{isFa ? 'سرعت آپلود' : 'Upload'}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#16A34A] transition-transform duration-150 group-hover:scale-110 dark:bg-[#0D2A1F] dark:text-[#4ADE80]">
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono text-base font-semibold">
            {stats.uploadSpeedBps !== null ? `${stats.uploadSpeedBps} B/s` : '--'}
          </p>
        </Card>

        <Card interactive padding="sm" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--asis-text-secondary)]">
            <span>{isFa ? 'ترافیک نشست' : 'Session Traffic'}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--asis-surface-2)] text-[var(--asis-text-secondary)] transition-transform duration-150 group-hover:scale-110">
              <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono text-base font-semibold">
            {formatBytesCompact(stats.sessionDownloadBytes + stats.sessionUploadBytes, '0 B')}
          </p>
        </Card>

        <Card interactive padding="sm" className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--asis-text-secondary)]">
            <span>{isFa ? 'سیاست مسیریابی' : 'Tunnel Policy'}</span>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              aria-label={isFa ? 'تنظیمات' : 'Settings'}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)] transition-transform duration-150 group-hover:scale-110 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="font-mono text-xs font-semibold truncate flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 shrink-0 text-[var(--asis-accent-fg)]" aria-hidden="true" />
            <span className="truncate">
              {policy.splitTunnelingMode === 'custom'
                ? `${isFa ? 'برنامه‌ای' : 'Per-App'} (${policy.splitTunnelingAppIds.length})`
                : policy.routingMode === 'global'
                  ? 'Global TUN'
                  : 'Rule-Based'}{' '}
              · DNS {policy.customDns}
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}
