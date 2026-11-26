import React, { useEffect, useState } from 'react';
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
  VpnEngineAdapter,
} from '../../engine';
import { validateAndParseOutbound } from '../../engine';
import { resolveCountryByCode, type ServerCatalogEntry } from '../servers';
import type { SubscriptionRecord } from '../subscriptions';
import { formatBytesCompact } from '../subscriptions';

interface HomeViewProps {
  engine: VpnEngineAdapter;
  policy: AdvancedConnectionPolicy;
  activeSubscription: SubscriptionRecord | null;
  selectedServer: ServerCatalogEntry | null;
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
  probingSelectedServer = false,
  onProbeSelectedServer,
  onNavigate,
}: HomeViewProps) {
  const { locale, dir } = usePreferences();
  const isFa = locale === 'fa-IR';

  const [connState, setConnState] = useState<ConnectionState>(() => engine.getConnectionState());
  const [engineError, setEngineError] = useState<{ code: string; message: string } | null>(null);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);

  const stats = engine.getConnectionStatistics();

  const fetchPublicIp = async () => {
    setIpLoading(true);
    try {
      const res = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        setPublicIp(null);
        return;
      }
      const data = (await res.json()) as { ip?: string };
      setPublicIp(typeof data.ip === 'string' ? data.ip : null);
    } catch {
      setPublicIp(null);
    } finally {
      setIpLoading(false);
    }
  };

  useEffect(() => {
    void fetchPublicIp();
  }, []);

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

  const handleToggleConnection = async () => {
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

    setConnState('Preparing');
    const outbound: SanitizedOutboundConfig =
      validateAndParseOutbound(
        JSON.stringify({
          type: selectedServer.protocol.toLowerCase().includes('vless')
            ? 'vless'
            : selectedServer.protocol.toLowerCase().replace(/\s+/g, ''),
          tag: selectedServer.name,
          server: selectedServer.hostRedacted,
          server_port: selectedServer.port ?? 443,
        }),
        engine.platform,
      ).outbound ?? {
        id: selectedServer.id,
        tag: selectedServer.name,
        protocol: 'VLESS',
        serverRedacted: selectedServer.hostRedacted,
        port: selectedServer.port ?? 443,
        transport: 'tcp',
        tlsSecurity: 'tls',
        singBoxOutbound: {
          type: 'vless',
          tag: 'proxy',
          server: selectedServer.hostRedacted,
          server_port: selectedServer.port ?? 443,
        },
      };

    try {
      await engine.connect(outbound, policy);
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
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-[var(--asis-chrome)] px-6 py-10 text-center border-b lg:border-b-0 lg:border-e border-[var(--asis-border)]">
            <ConnectionButton
              connState={connState}
              hasSelectedServer={Boolean(selectedServer)}
              isFa={isFa}
              onToggle={() => void handleToggleConnection()}
            />

            <div className="mt-5 space-y-1">
              <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
                {isConnected ? (
                  <Shield className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                ) : (
                  <ShieldAlert
                    className={`w-4 h-4 ${
                      connState === 'Error'
                        ? 'text-[#DC2626] dark:text-[#F87171]'
                        : 'text-[var(--asis-text-secondary)]'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span>{stateLabel(connState)}</span>
              </div>
              <p className="font-mono text-xl font-semibold tracking-tight text-[var(--asis-text-primary)]">
                {formatDuration(stats.sessionDurationSec)}
              </p>
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
                    {isFa ? 'IP عمومی شبکه' : 'Current Public IP'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void fetchPublicIp()}
                    disabled={ipLoading}
                    aria-label={isFa ? 'بروزرسانی IP' : 'Refresh public IP'}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#087BFF] hover:text-[#1684FF] dark:text-[#60A5FA] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ipLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="font-mono text-sm font-semibold">
                  {publicIp ?? (isFa ? 'ناموجود' : 'Unavailable')}
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
              </div>

              <div className="px-6 py-5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isFa ? 'کشور خروجی تونل' : 'Exit Region'}</span>
                </div>
                <p className="text-sm font-semibold truncate flex items-center gap-2">
                  {selectedServer?.countryCode || selectedServer?.countryName ? (
                    <>
                      <CountryFlag
                        code={selectedServer.countryCode}
                        emoji={selectedServer.countryFlag}
                      />
                      <span className="truncate">
                        {isFa
                          ? (resolveCountryByCode(selectedServer.countryCode)?.nameFa ??
                            selectedServer.countryName ??
                            selectedServer.countryCode)
                          : (resolveCountryByCode(selectedServer.countryCode)?.nameEn ??
                            selectedServer.countryName ??
                            selectedServer.countryCode)}
                      </span>
                    </>
                  ) : isFa ? (
                    'انتخاب نشده'
                  ) : (
                    'Not selected'
                  )}
                </p>
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
