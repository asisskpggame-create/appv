import React, { useEffect, useRef, useState } from 'react';
import { WorldMapDots } from './WorldMapDots';
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
import { BrandLogo } from '../../design-system/components';
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
        return 'متصل هستید';
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

  const totalBytes = stats.sessionDownloadBytes + stats.sessionUploadBytes;
  const cityLabel = (shownServer as { city?: string } | null)?.city;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-start">
      {/* Brand + connection status over the glowing map */}
      <section className="relative flex flex-col items-center overflow-hidden rounded-3xl px-4 pb-4 pt-5 text-center">
        <div aria-hidden="true" className="asis-hero-map pointer-events-none absolute inset-0" />
        <WorldMapDots
          className="pointer-events-none absolute inset-0 h-full w-full opacity-40 [mask-image:radial-gradient(ellipse_90%_80%_at_50%_45%,#000_35%,transparent_85%)]"
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <BrandLogo glow className="h-28 w-28 shadow-[0_0_34px_2px_rgba(29,134,255,0.5)]" />
          <p className="text-lg font-extrabold tracking-wide text-white [text-shadow:0_0_14px_rgba(59,152,255,0.85)]" dir="ltr">
            ASiS VPN
          </p>

          <div
            className={`mt-1 inline-flex items-center gap-2 rounded-full border px-5 py-1.5 text-sm font-bold ${
              isConnected
                ? 'border-[#22C55E]/60 bg-gradient-to-b from-[#16A34A]/70 to-[#15803D]/70 text-white shadow-[0_0_22px_-2px_rgba(34,197,94,0.75)]'
                : connState === 'Error'
                  ? 'border-[#DC2626]/50 bg-[#DC2626]/15 text-[#F87171]'
                  : 'border-[var(--asis-border-strong)] bg-[var(--asis-surface-2)] text-[var(--asis-text-secondary)]'
            }`}
          >
            {isConnected ? <Shield className="h-4 w-4" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
            <span>{stateLabel(connState)}</span>
          </div>
          <p className="font-mono text-2xl font-semibold tracking-wider text-white" dir="ltr">
            {formatDuration(stats.sessionDurationSec)}
          </p>
        </div>
      </section>

      {engineError && (
        <StatusBanner
          tone="warning"
          title={engineError.code}
          description={
            isFa
              ? 'برقراری تونل شبکه در مرورگر پشتیبانی نمی‌شود و در نسخه بومی اندروید، iOS یا ویندوز اجرا خواهد شد.'
              : engineError.message
          }
        />
      )}

      {isConnected && (exitStatus === 'leak' || exitStatus === 'mismatch') && exitInfo && (
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
        />
      )}

      {/* Download / Upload */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" elevated className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[var(--asis-text-secondary)]">
            <ArrowDown className="h-4 w-4 text-[var(--asis-accent-fg)]" aria-hidden="true" />
            <span>{isFa ? 'دانلود' : 'Download'}</span>
          </div>
          <p className="font-mono text-lg font-bold" dir="ltr">
            {formatBytesCompact(stats.sessionDownloadBytes, '0 B')}
          </p>
          <p className="font-mono text-[11px] text-[var(--asis-text-secondary)]" dir="ltr">
            {stats.downloadSpeedBps !== null ? `${stats.downloadSpeedBps} B/s` : '--'}
          </p>
        </Card>
        <Card padding="sm" elevated className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[var(--asis-text-secondary)]">
            <ArrowUp className="h-4 w-4 text-[var(--asis-accent-fg)]" aria-hidden="true" />
            <span>{isFa ? 'آپلود' : 'Upload'}</span>
          </div>
          <p className="font-mono text-lg font-bold" dir="ltr">
            {formatBytesCompact(stats.sessionUploadBytes, '0 B')}
          </p>
          <p className="font-mono text-[11px] text-[var(--asis-text-secondary)]" dir="ltr">
            {stats.uploadSpeedBps !== null ? `${stats.uploadSpeedBps} B/s` : '--'}
          </p>
        </Card>
      </div>

      {/* Selected server */}
      <button
        type="button"
        onClick={() => onNavigate('locations')}
        className="asis-glass flex w-full items-center gap-3 rounded-2xl border border-[var(--asis-primary-border)]/70 bg-[var(--asis-surface)] px-4 py-3.5 text-start cursor-pointer"
      >
        {selectedServer ? (
          <>
            <CountryFlag code={selectedServer.countryCode} emoji={selectedServer.countryFlag} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{selectedServer.name}</p>
              <p className="truncate text-xs text-[var(--asis-text-secondary)]">
                {cityLabel ?? selectedServer.protocol}
                {selectedServer.route === 'tunnel' ? (isFa ? ' · تانل' : ' · Tunnel') : ''}
              </p>
            </div>
            <div className="shrink-0 text-xs font-mono" dir="ltr">
              <LatencyIndicator
                latencyMs={selectedServer.probeLatencyMs}
                available={selectedServer.available}
                probing={probingSelectedServer}
                isFa={isFa}
              />
            </div>
          </>
        ) : (
          <>
            <Globe className="h-6 w-6 shrink-0 text-[var(--asis-accent-fg)]" aria-hidden="true" />
            <p className="flex-1 text-sm font-semibold">
              {isFa ? 'انتخاب سرور از فهرست' : 'Choose a server'}
            </p>
          </>
        )}
        <ChevronRight
          className={`h-5 w-5 shrink-0 text-[var(--asis-text-secondary)] ${dir === 'rtl' ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Power button */}
      <div className="flex flex-col items-center py-3">
        <ConnectionButton
          connState={connState}
          hasSelectedServer={Boolean(selectedServer)}
          isFa={isFa}
          onToggle={() => void handleToggleConnection()}
        />
      </div>

      {isConnected && exitInfo?.ip && (
        <p className="text-center font-mono text-xs text-[var(--asis-text-secondary)]" dir="ltr">
          IP {exitInfo.ip}
          {exitInfo.countryCode ? ` · ${exitInfo.countryCode}` : ''}
        </p>
      )}
    </div>
  );
}
