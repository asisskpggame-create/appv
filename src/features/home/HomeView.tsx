import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Crown,
  Globe,
  Layers,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sliders,
  Stethoscope,
  Wifi,
  Zap,
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
  /** Switch the selected server (used by the fastest-server card). */
  onSelectServer?: (server: ServerCatalogEntry) => void;
  /** Measure latency of several servers at once (used by the fastest-server card). */
  onProbeServers?: (servers: ServerCatalogEntry[]) => void;
  onNavigate: (view: 'locations' | 'subscriptions' | 'support' | 'settings') => void;
}

/** Tiny live chart for a speed history (newest sample on the right). */
function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  const w = 96;
  const h = 28;
  const max = Math.max(1, ...values);
  const pts = values.length >= 2 ? values : [0, 0];
  const step = w / (pts.length - 1);
  const points = pts.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="currentColor" opacity="0.14" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const SPARK_POINTS = 24;

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
  onSelectServer,
  onProbeServers,
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

  // Rolling speed history for the two mini charts (one sample per second while connected).
  const [downHistory, setDownHistory] = useState<number[]>([]);
  const [upHistory, setUpHistory] = useState<number[]>([]);
  const latestSpeeds = useRef({ down: 0, up: 0 });
  latestSpeeds.current = { down: stats.downloadSpeedBps ?? 0, up: stats.uploadSpeedBps ?? 0 };

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

  useEffect(() => {
    if (connState !== 'Connected') {
      setDownHistory([]);
      setUpHistory([]);
      return;
    }
    const timer = setInterval(() => {
      setDownHistory((prev) => [...prev.slice(-(SPARK_POINTS - 1)), latestSpeeds.current.down]);
      setUpHistory((prev) => [...prev.slice(-(SPARK_POINTS - 1)), latestSpeeds.current.up]);
    }, 1000);
    return () => clearInterval(timer);
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
  const isBusy = connState === 'Preparing' || connState === 'Connecting' || connState === 'Reconnecting' || connState === 'Disconnecting';
  const cityLabel = (shownServer as { city?: string } | null)?.city;

  const statusTone = isConnected
    ? 'text-[#2BB673]'
    : connState === 'Error'
      ? 'text-[#D64545]'
      : isBusy
        ? 'text-[var(--asis-accent-fg)]'
        : 'text-[var(--asis-text-secondary)]';
  const dotTone = isConnected
    ? 'bg-[#2BB673] asis-status-dot-live'
    : connState === 'Error'
      ? 'bg-[#D64545]'
      : isBusy
        ? 'bg-[var(--asis-primary)]'
        : 'bg-[var(--asis-text-secondary)]/60';

  // Fastest server card: candidates come sorted best-first; only measured latency counts.
  const bestServer = autoSwitchCandidates.find((c) => c.probeLatencyMs !== null) ?? null;
  const untestedCandidates = autoSwitchCandidates
    .filter((c) => c.probeLatencyMs === null && c.probeHost && c.port)
    .slice(0, 12);
  const probingAny = probingSelectedServer;
  const showFastestCard =
    !isConnected &&
    !isBusy &&
    Boolean(selectedServer) &&
    ((bestServer !== null && bestServer.id !== selectedServer?.id) ||
      (bestServer === null && untestedCandidates.length > 0 && Boolean(onProbeServers)));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 text-start">
      {/* Top row: brand + status chip on one side, plan chip on the other */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo className="h-9 w-9 shrink-0" glow />
          <div className="min-w-0">
            <span className="block text-base font-bold leading-tight tracking-tight" dir="ltr">
              ASiS VPN
            </span>
            <span className={`flex items-center gap-1.5 text-[11px] font-medium leading-tight ${statusTone}`} aria-live="polite">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotTone}`} />
              {stateLabel(connState)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('subscriptions')}
          className="asis-glass inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-xs font-semibold text-[var(--asis-accent-fg)]"
        >
          <Crown className="h-4 w-4" aria-hidden="true" />
          {isFa ? 'اشتراک' : 'Plan'}
        </button>
      </header>

      {/* Timer */}
      <section className="flex flex-col items-center gap-1 pt-1 text-center">
        <p
          className={`font-mono text-[48px] font-light leading-none tracking-tight transition-colors ${
            isConnected ? 'asis-neon-text text-[var(--asis-text-primary)]' : 'text-[var(--asis-text-secondary)]/50'
          }`}
          dir="ltr"
        >
          {formatDuration(stats.sessionDurationSec)}
        </p>
        <p className="h-4 font-mono text-xs text-[var(--asis-text-secondary)]" dir="ltr">
          {isConnected && exitInfo?.ip ? `${exitInfo.ip}${exitInfo.countryCode ? ` · ${exitInfo.countryCode}` : ''}` : ''}
        </p>
      </section>

      {/* Connect control */}
      <div className="-my-2 flex flex-col items-center">
        <ConnectionButton
          connState={connState}
          hasSelectedServer={Boolean(selectedServer)}
          isFa={isFa}
          onToggle={() => void handleToggleConnection()}
        />
      </div>

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

      {/* Fastest server shortcut */}
      {showFastestCard && (
        <div className="asis-glass flex items-center gap-3 rounded-3xl px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--asis-primary)] text-white shadow-[0_6px_18px_-4px_rgba(var(--asis-glow-rgb),0.8)]">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">
              {bestServer ? (isFa ? 'سریع‌ترین سرور' : 'Fastest server') : isFa ? 'پیدا کردن سریع‌ترین سرور' : 'Find the fastest server'}
            </p>
            <p className="truncate text-xs text-[var(--asis-text-secondary)]">
              {bestServer
                ? `${bestServer.name} · ${bestServer.probeLatencyMs} ms`
                : isFa
                  ? 'پینگ سرورهای اشتراک را بسنج'
                  : 'Measure the ping of your subscription servers'}
            </p>
          </div>
          <button
            type="button"
            disabled={probingAny}
            onClick={() => {
              if (bestServer) onSelectServer?.(bestServer);
              else onProbeServers?.(untestedCandidates);
            }}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-[var(--asis-primary-soft)] px-4 text-xs font-semibold text-[var(--asis-accent-fg)] disabled:opacity-50"
          >
            {bestServer ? (isFa ? 'استفاده' : 'Use') : isFa ? 'تست' : 'Test'}
          </button>
        </div>
      )}

      {/* Selected server */}
      <button
        type="button"
        onClick={() => onNavigate('locations')}
        className={`asis-glass flex w-full cursor-pointer items-center gap-3.5 rounded-3xl px-4 py-3.5 text-start transition-colors ${
          isConnected ? 'asis-glass-active' : ''
        }`}
      >
        {selectedServer ? (
          <>
            <CountryFlag code={selectedServer.countryCode} emoji={selectedServer.countryFlag} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{selectedServer.name}</p>
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--asis-surface-2)] text-[var(--asis-text-secondary)]">
              <Globe className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{isFa ? 'سروری انتخاب نشده' : 'No server selected'}</p>
              <p className="text-xs text-[var(--asis-text-secondary)]">
                {isFa ? 'برای شروع یک سرور انتخاب کنید' : 'Pick a server to get started'}
              </p>
            </div>
          </>
        )}
        <ChevronRight
          className={`h-5 w-5 shrink-0 text-[var(--asis-text-secondary)] ${dir === 'rtl' ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Session traffic: two glass chips with live mini charts */}
      <section aria-label={isFa ? 'مصرف این نشست' : 'This session'} className="grid grid-cols-2 gap-3">
        {[
          {
            key: 'down',
            icon: ArrowDown,
            label: isFa ? 'دانلود' : 'Download',
            bytes: stats.sessionDownloadBytes,
            speed: stats.downloadSpeedBps,
            history: downHistory,
            tone: 'text-[#2BB673]',
          },
          {
            key: 'up',
            icon: ArrowUp,
            label: isFa ? 'آپلود' : 'Upload',
            bytes: stats.sessionUploadBytes,
            speed: stats.uploadSpeedBps,
            history: upHistory,
            tone: 'text-[var(--asis-accent-fg)]',
          },
        ].map(({ key, icon: Icon, label, bytes, speed, history, tone }) => (
          <div key={key} className="asis-glass overflow-hidden rounded-3xl px-4 py-3.5">
            <div className="flex items-center gap-2 text-xs text-[var(--asis-text-secondary)]">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-[var(--asis-surface-2)] ${tone}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>{label}</span>
            </div>
            <p className="mt-2 font-mono text-lg font-semibold" dir="ltr">
              {formatBytesCompact(bytes, '0 B')}
            </p>
            <p className="font-mono text-[11px] text-[var(--asis-text-secondary)]" dir="ltr">
              {speed !== null ? `${speed} B/s` : '--'}
            </p>
            <Sparkline values={history} className={`mt-2 h-7 w-full ${tone}`} />
          </div>
        ))}
      </section>
    </div>
  );
}
