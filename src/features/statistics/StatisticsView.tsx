import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import { resolveThemeCssVariables } from '../../design-system/themeEngine';
import {
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  StatusBanner,
  TrafficChartSkeleton,
  UsageMetricsSkeleton,
} from '../../design-system/components';
import { PROTOCOL_SUPPORT_MATRIX, type LocalEngineStatistics } from '../../engine';
import type { AuthSession } from '../auth';
import { formatBytesCompact, type SubscriptionRecord } from '../subscriptions';
import {
  computeQuotaBreakdown,
  normalizeAuthoritativeUsageResponse,
  normalizeUsageHistory,
} from './trafficUtils';
import type {
  AuthoritativeUsagePayload,
  TrafficChartDatum,
  TrafficChartMode,
  TrafficChartSource,
  TrafficGranularity,
  TrafficHistoryPoint,
} from './types';

interface StatisticsViewProps {
  session: AuthSession | null;
  activeSubscription: SubscriptionRecord | null;
  engineStats: LocalEngineStatistics;
  /** Optional pre-populated local session history buckets from native VPN bridge */
  localTrafficHistory?: TrafficHistoryPoint[];
}

interface CustomTooltipPayloadItem {
  dataKey?: string;
  payload?: TrafficChartDatum;
}

interface TrafficTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  isFa: boolean;
  unavailableLabel: string;
}

function TrafficChartTooltip({ active, payload, isFa, unavailableLabel }: TrafficTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const datum = payload[0].payload;

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className="asis-glass min-w-[180px] rounded-2xl px-3.5 py-2.5 text-xs"
    >
      <p className="border-b border-[var(--asis-border)] pb-1.5 font-mono text-[11px] font-medium text-[var(--asis-text-secondary)]">
        {datum.label}
      </p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--asis-text-primary)]">
            <span className="h-2 w-2 rounded-xs bg-[var(--asis-chart-primary)]" aria-hidden="true" />
            {isFa ? 'دانلود' : 'Download'}
          </span>
          <span className="font-mono font-semibold text-[var(--asis-text-primary)]">
            {formatBytesCompact(datum.downloadBytes, unavailableLabel)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--asis-text-primary)]">
            <span className="h-2 w-2 rounded-xs bg-[var(--asis-chart-secondary)]" aria-hidden="true" />
            {isFa ? 'آپلود' : 'Upload'}
          </span>
          <span className="font-mono font-semibold text-[var(--asis-text-primary)]">
            {formatBytesCompact(datum.uploadBytes, unavailableLabel)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--asis-border)] pt-1.5">
          <span className="text-[var(--asis-text-secondary)]">{isFa ? 'مجموع' : 'Total'}</span>
          <span className="font-mono font-semibold text-[var(--asis-accent-fg)]">
            {formatBytesCompact(datum.totalBytes, unavailableLabel)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function StatisticsView({
  session,
  activeSubscription,
  engineStats,
  localTrafficHistory,
}: StatisticsViewProps) {
  const { locale, theme, palette } = usePreferences();
  const isFa = locale === 'fa-IR';
  const isDark = theme === 'dark';
  const gradientIdPrefix = useId().replace(/:/g, '');

  const [usageError, setUsageError] = useState<string | null>(null);
  const [serverUsage, setServerUsage] = useState<AuthoritativeUsagePayload | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const [granularity, setGranularity] = useState<TrafficGranularity>('7d');
  const [chartSource, setChartSource] = useState<TrafficChartSource>('server_authoritative');
  const [chartMode, setChartMode] = useState<TrafficChartMode>('bar');
  const [recordedLocalPoints, setRecordedLocalPoints] = useState<TrafficHistoryPoint[]>(
    () => localTrafficHistory ?? [],
  );

  useEffect(() => {
    if (localTrafficHistory) {
      setRecordedLocalPoints(localTrafficHistory);
    }
  }, [localTrafficHistory]);

  // Append genuine non-zero local engine delta samples when running with an active native bridge
  useEffect(() => {
    const down = engineStats.sessionDownloadBytes;
    const up = engineStats.sessionUploadBytes;
    if (down <= 0 && up <= 0) {
      return;
    }
    setRecordedLocalPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.downloadBytes === down && last.uploadBytes === up) {
        return prev;
      }
      const nextPoint: TrafficHistoryPoint = {
        timestamp: new Date().toISOString(),
        downloadBytes: down,
        uploadBytes: up,
        totalBytes: down + up,
      };
      return [...prev.slice(-23), nextPoint];
    });
  }, [engineStats.sessionDownloadBytes, engineStats.sessionUploadBytes]);

  const fetchAuthoritativeUsage = useCallback(
    async (targetGranularity: TrafficGranularity) => {
      setLoadingUsage(true);
      setUsageError(null);
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (session?.tokens.accessToken) {
          headers.Authorization = `Bearer ${session.tokens.accessToken}`;
        }
        const params = new URLSearchParams({ granularity: targetGranularity });
        if (activeSubscription?.id) {
          params.set('subscriptionId', activeSubscription.id);
        }
        const res = await fetch(`/api/v1/usage?${params.toString()}`, { headers });
        const body = (await res.json().catch(() => ({}))) as {
          error?: { code?: string; message?: string };
        };

        if (!res.ok) {
          setUsageError(
            body.error?.message
              ? `${body.error.code ?? 'GATEWAY'}: ${body.error.message}`
              : isFa
                ? 'مسیر استعلام مصرف رسمی سرور هنوز متصل نشده است.'
                : 'Authoritative usage endpoint is not connected.',
          );
          return;
        }

        const normalized = normalizeAuthoritativeUsageResponse(body, targetGranularity);
        if (normalized) {
          setServerUsage(normalized);
        }
      } catch {
        setUsageError(
          isFa ? 'درگاه API در دسترس نیست.' : 'Unable to reach usage endpoint on gateway.',
        );
      } finally {
        setLoadingUsage(false);
      }
    },
    [session?.tokens.accessToken, activeSubscription?.id, isFa],
  );

  const handleGranularityChange = (next: TrafficGranularity) => {
    setGranularity(next);
    if (chartSource === 'server_authoritative' && session?.tokens.accessToken && serverUsage) {
      void fetchAuthoritativeUsage(next);
    }
  };

  const unavailable = isFa ? 'ناموجود' : 'Unavailable';
  const quota = computeQuotaBreakdown(
    serverUsage?.dataLimitBytes ?? activeSubscription?.totalBytes ?? null,
    serverUsage?.usedTrafficBytes ?? activeSubscription?.usedBytes ?? null,
    activeSubscription?.remainingBytes ?? null,
  );

  const rawHistoryPoints =
    chartSource === 'server_authoritative'
      ? (serverUsage?.history ?? [])
      : recordedLocalPoints;

  const normalizedChart = useMemo(
    () => normalizeUsageHistory(rawHistoryPoints, granularity, locale),
    [rawHistoryPoints, granularity, locale],
  );

  const activeVars = resolveThemeCssVariables(theme, palette);
  const downloadColor = activeVars['--asis-chart-primary'];
  const uploadColor = activeVars['--asis-chart-secondary'];
  const gridColor = activeVars['--asis-border'];
  const axisTickColor = activeVars['--asis-text-secondary'];
  const downloadGradId = `asis-dl-${gradientIdPrefix}`;
  const uploadGradId = `asis-ul-${gradientIdPrefix}`;

  return (
    <div className="space-y-5 text-start md:space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--asis-border)] pb-5 max-md:border-0 max-md:pb-0">
        <div className="hidden md:block">
          <h2 className="text-xl font-semibold tracking-tight">
            {isFa ? 'آمار مصرف و پشتیبانی پروتکل‌ها' : 'Traffic Statistics & Engine Compatibility'}
          </h2>
          <p className="mt-1 text-sm text-[var(--asis-text-secondary)]">
            {isFa
              ? 'تفکیک شفاف میان آمار محلی موتور کلاینت و ترافیک رسمی سرور (PasarGuard)'
              : 'Clear separation between local engine counters and authoritative server-side billing usage.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="max-md:w-full"
          loading={loadingUsage}
          icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          onClick={() => void fetchAuthoritativeUsage(granularity)}
        >
          {isFa ? 'استعلام مصرف رسمی سرور' : 'Sync Server Usage'}
        </Button>
      </div>

      {/* Visual Traffic Usage History (Recharts) */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--asis-border)] pb-4">
          <div>
            <h3 className="text-sm font-semibold">
              {isFa ? 'نمودار تاریخچه مصرف آپلود و دانلود' : 'Upload & Download Traffic History'}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--asis-text-secondary)]">
              {chartSource === 'server_authoritative'
                ? isFa
                  ? 'بر اساس داده‌های رسمی بازه‌بندی‌شده مسیر /api/v1/usage'
                  : 'Time-bucketed authoritative transfer metrics from /api/v1/usage'
                : isFa
                  ? 'نمونه‌های ترافیک ثبت‌شده توسط موتور بومی دستگاه در طول نشست'
                  : 'Live transfer samples recorded by the native VPN engine during active sessions'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden">
            <SegmentedControl<TrafficChartSource>
              ariaLabel={isFa ? 'منبع نمودار ترافیک' : 'Traffic chart source'}
              value={chartSource}
              onChange={setChartSource}
              options={[
                { value: 'server_authoritative', label: isFa ? 'سرور' : 'Server' },
                { value: 'local_engine', label: isFa ? 'موتور محلی' : 'Local' },
              ]}
            />
            </div>

            <SegmentedControl<TrafficGranularity>
              ariaLabel={isFa ? 'بازه زمانی تاریخچه ترافیک' : 'Traffic history timeframe'}
              value={granularity}
              onChange={handleGranularityChange}
              options={[
                { value: '24h', label: isFa ? 'روزانه' : '24h' },
                { value: '7d', label: isFa ? 'هفتگی' : '7d' },
                { value: '30d', label: isFa ? 'ماهانه' : '30d' },
              ]}
            />

            <div className="hidden">
            <SegmentedControl<TrafficChartMode>
              ariaLabel={isFa ? 'نوع نمودار' : 'Chart display style'}
              value={chartMode}
              onChange={setChartMode}
              options={[
                { value: 'area', label: isFa ? 'منحنی' : 'Area' },
                { value: 'bar', label: isFa ? 'ستونی' : 'Bar' },
              ]}
            />
            </div>
          </div>
        </div>

        {loadingUsage && chartSource === 'server_authoritative' ? (
          <TrafficChartSkeleton />
        ) : normalizedChart.series.length > 0 ? (
          <div className="space-y-4">
            {/* Series Summary Cards: download / upload / total */}
            <div className="grid grid-cols-2 gap-2" data-testid="stats-summary-cards">
              <div className="asis-glass rounded-3xl p-3 text-center">
                <ArrowDownToLine className="mx-auto h-4 w-4 text-[var(--asis-chart-primary)]" aria-hidden="true" />
                <p className="mt-1 text-[11px] text-[var(--asis-text-secondary)]">
                  {isFa ? 'دانلود' : 'Download'}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--asis-text-primary)]" dir="ltr">
                  {formatBytesCompact(normalizedChart.totalDownloadBytes, '0 B')}
                </p>
              </div>
              <div className="asis-glass rounded-3xl p-3 text-center">
                <ArrowUpFromLine className="mx-auto h-4 w-4 text-[var(--asis-chart-secondary)]" aria-hidden="true" />
                <p className="mt-1 text-[11px] text-[var(--asis-text-secondary)]">
                  {isFa ? 'آپلود' : 'Upload'}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--asis-text-primary)]" dir="ltr">
                  {formatBytesCompact(normalizedChart.totalUploadBytes, '0 B')}
                </p>
              </div>
            </div>

            {/* Big total-usage card (design: "مصرف کل" under the download/upload pair) */}
            <div
              className="asis-glass rounded-3xl p-4 text-center"
              data-testid="stats-total-card"
            >
              <p className="text-xs text-[var(--asis-text-secondary)]">
                {isFa ? 'مصرف کل' : 'Total usage'}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-[var(--asis-text-primary)]" dir="ltr">
                {formatBytesCompact(normalizedChart.totalBytes, '0 B')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[var(--asis-text-secondary)]">
                {isFa ? 'اوج بازه:' : 'Peak:'}{' '}
                <span className="font-mono font-semibold text-[var(--asis-text-primary)]" dir="ltr">
                  {formatBytesCompact(normalizedChart.peakBucketBytes, '0 B')}
                </span>
              </span>
              <span className="font-mono text-[11px] text-[var(--asis-text-secondary)]">
                {isFa ? `واحد محور: ${normalizedChart.unit}` : `Unit: ${normalizedChart.unit}`}
              </span>
            </div>

            {/* Recharts Responsive Viewport (always LTR coordinates for crisp axis math) */}
            <div
              dir="ltr"
              className="h-[260px] w-full"
              role="img"
              aria-label={
                isFa
                  ? 'نمودار تاریخچه مصرف آپلود و دانلود'
                  : 'Upload and download traffic usage history chart'
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'area' ? (
                  <AreaChart
                    data={normalizedChart.series}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id={downloadGradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={downloadColor} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={downloadColor} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id={uploadGradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={uploadColor} stopOpacity={0.24} />
                        <stop offset="100%" stopColor={uploadColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={axisTickColor}
                      tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      tickLine={false}
                      axisLine={{ stroke: gridColor }}
                      minTickGap={16}
                    />
                    <YAxis
                      stroke={axisTickColor}
                      tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(val: number) => `${val}`}
                    />
                    <Tooltip
                      content={<TrafficChartTooltip isFa={isFa} unavailableLabel={unavailable} />}
                      cursor={{ stroke: gridColor, strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="downloadScaled"
                      name={isFa ? 'دانلود' : 'Download'}
                      stroke={downloadColor}
                      strokeWidth={2}
                      fill={`url(#${downloadGradId})`}
                      activeDot={{ r: 4, strokeWidth: 0, fill: downloadColor }}
                    />
                    <Area
                      type="monotone"
                      dataKey="uploadScaled"
                      name={isFa ? 'آپلود' : 'Upload'}
                      stroke={uploadColor}
                      strokeWidth={2}
                      fill={`url(#${uploadGradId})`}
                      activeDot={{ r: 4, strokeWidth: 0, fill: uploadColor }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={normalizedChart.series}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    barGap={4}
                  >
                    <defs>
                      <linearGradient id={`${downloadGradId}-bar`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={downloadColor} stopOpacity={1} />
                        <stop offset="100%" stopColor={downloadColor} stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id={`${uploadGradId}-bar`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={uploadColor} stopOpacity={1} />
                        <stop offset="100%" stopColor={uploadColor} stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={axisTickColor}
                      tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      tickLine={false}
                      axisLine={{ stroke: gridColor }}
                      minTickGap={16}
                    />
                    <YAxis
                      stroke={axisTickColor}
                      tick={{ fill: axisTickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(val: number) => `${val}`}
                    />
                    <Tooltip
                      content={<TrafficChartTooltip isFa={isFa} unavailableLabel={unavailable} />}
                      cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(8,123,255,0.04)' }}
                    />
                    <Bar
                      dataKey="downloadScaled"
                      name={isFa ? 'دانلود' : 'Download'}
                      fill={`url(#${downloadGradId}-bar)`}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="uploadScaled"
                      name={isFa ? 'آپلود' : 'Upload'}
                      fill={`url(#${uploadGradId}-bar)`}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyState
            title={
              chartSource === 'server_authoritative'
                ? isFa
                  ? 'تاریخچه مصرف سرور هنوز دریافت نشده است'
                  : 'No server traffic history available yet'
                : isFa
                  ? 'ترافیک نشست محلی ثبت نشده است'
                  : 'No local tunnel traffic recorded yet'
            }
            description={
              chartSource === 'server_authoritative'
                ? isFa
                  ? 'پس از اتصال آداپتور PasarGuard در درگاه /api/v1/usage و همگام‌سازی حساب، نمودار ساعتی و روزانه آپلود و دانلود نمایش داده می‌شود.'
                  : 'Hourly and daily upload/download history buckets appear automatically once /api/v1/usage is synced with an active PasarGuard adapter.'
                : isFa
                  ? 'تاریخچه مصرف محلی فقط پس از برقراری تونل واقعی روی نسخه بومی اندروید، iOS یا ویندوز ثبت می‌شود.'
                  : 'Local upload/download buckets are sampled only during real OS tunnel sessions on Android, iOS, or Windows.'
            }
            actionLabel={
              chartSource === 'server_authoritative'
                ? isFa
                  ? 'استعلام مصرف رسمی سرور'
                  : 'Sync Server Usage'
                : undefined
            }
            onAction={
              chartSource === 'server_authoritative'
                ? () => void fetchAuthoritativeUsage(granularity)
                : undefined
            }
          />
        )}
      </Card>

      {/* Technical details: server usage vs local counters. Collapsed, most people do not need it. */}
      <details className="asis-details asis-glass group rounded-3xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium transition-colors duration-150 hover:bg-[var(--asis-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)] [&::-webkit-details-marker]:hidden">
          <span>{isFa ? 'جزئیات فنی مصرف' : 'Technical usage details'}</span>
          <span aria-hidden="true" className="text-xs text-[var(--asis-text-secondary)] transition-transform duration-200 group-open:rotate-180">▾</span>
        </summary>
        <div className="asis-view-enter p-3 md:p-4">
      {/* Authoritative Server-Side Usage vs Local Engine Counters */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {isFa ? 'مصرف رسمی اشتراک (سمت سرور)' : 'Authoritative Subscription Usage (Server)'}
            </h3>
            <span
              className={`font-mono text-xs whitespace-nowrap shrink-0 ${
                serverUsage || activeSubscription?.source === 'account'
                  ? 'text-[#2BB673] dark:text-[#3BC48A]'
                  : 'text-[#B7791F] dark:text-[#E0A030]'
              }`}
            >
              {serverUsage || activeSubscription?.source === 'account'
                ? 'Server Authoritative'
                : 'NOT CONNECTED'}
            </span>
          </div>

          {usageError && <StatusBanner tone="warning" title={usageError} />}

          {loadingUsage ? (
            <UsageMetricsSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[var(--asis-text-secondary)]">{isFa ? 'کل حجم' : 'Total'}</p>
                  <p className="mt-1 font-mono text-sm font-semibold">
                    {formatBytesCompact(quota.totalBytes, unavailable)}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--asis-text-secondary)]">{isFa ? 'مصرف‌شده' : 'Used'}</p>
                  <p className="mt-1 font-mono text-sm font-semibold">
                    {formatBytesCompact(quota.usedBytes, unavailable)}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--asis-text-secondary)]">{isFa ? 'باقیمانده' : 'Remaining'}</p>
                  <p className="mt-1 font-mono text-sm font-semibold">
                    {formatBytesCompact(quota.remainingBytes, unavailable)}
                  </p>
                </div>
              </div>

              {quota.usedPercent !== null && (
                <div className="space-y-1.5 border-t border-[var(--asis-border)] pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--asis-text-secondary)]">
                      {isFa ? 'سهمیه مصرف‌شده' : 'Quota utilization'}
                    </span>
                    <span className="font-mono font-semibold text-[var(--asis-text-primary)]">
                      {quota.usedPercent}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={quota.usedPercent}
                    aria-label={isFa ? 'درصد مصرف حجم اشتراک' : 'Subscription traffic quota used'}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--asis-primary-soft)]"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        quota.usedPercent >= 95
                          ? 'bg-[#D64545] dark:bg-[#F07070]'
                          : quota.usedPercent >= 80
                            ? 'bg-[#B7791F] dark:bg-[#E0A030]'
                            : 'bg-[var(--asis-primary)]'
                      }`}
                      style={{ width: `${quota.usedPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="hidden space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--asis-accent-fg)] shrink-0" aria-hidden="true" />
              <h3 className="text-sm font-semibold">
                {isFa ? 'آمار موتور محلی کلاینت' : 'Local Engine Statistics (Non-Billing)'}
              </h3>
            </div>
            <span className="font-mono text-xs text-[var(--asis-text-secondary)] whitespace-nowrap shrink-0">
              source: {engineStats.source}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-[var(--asis-text-secondary)]">{isFa ? 'دانلود نشست' : 'Session Down'}</p>
              <p className="mt-1 font-mono text-sm font-semibold">
                {formatBytesCompact(engineStats.sessionDownloadBytes, '0 B')}
              </p>
            </div>
            <div>
              <p className="text-[var(--asis-text-secondary)]">{isFa ? 'آپلود نشست' : 'Session Up'}</p>
              <p className="mt-1 font-mono text-sm font-semibold">
                {formatBytesCompact(engineStats.sessionUploadBytes, '0 B')}
              </p>
            </div>
            <div>
              <p className="text-[var(--asis-text-secondary)]">{isFa ? 'کل نشست' : 'Session Total'}</p>
              <p className="mt-1 font-mono text-sm font-semibold">
                {formatBytesCompact(
                  engineStats.sessionDownloadBytes + engineStats.sessionUploadBytes,
                  '0 B',
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--asis-border)] pt-3 text-xs text-[var(--asis-text-secondary)]">
            <span>{isFa ? 'شمارنده محلی فقط برای پایش تونل دستگاه است' : 'Client-side tunnel counters only'}</span>
            <span className="font-mono">
              {engineStats.sessionDurationSec > 0
                ? `${Math.floor(engineStats.sessionDurationSec / 60)}m ${engineStats.sessionDurationSec % 60}s`
                : isFa
                  ? 'بدون نشست فعال'
                  : 'Idle'}
            </span>
          </div>
        </Card>
      </div>
        </div>
      </details>

      {/* Protocol Engine Support Matrix */}
      <Card padding="none" className="hidden overflow-x-auto md:block">
        <div className="border-b border-[var(--asis-border)] px-5 py-4">
          <h3 className="text-sm font-semibold">
            {isFa ? 'ماتریس پشتیبانی پروتکل‌ها و موتور VPN' : 'VPN Engine Protocol Support Matrix'}
          </h3>
        </div>
        <table className="w-full text-start text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--asis-border)] text-[var(--asis-text-secondary)]">
              <th className="px-4 py-3 text-start font-medium">Protocol</th>
              <th className="px-4 py-3 text-start font-medium">Engine</th>
              <th className="px-4 py-3 text-start font-medium">Native Targets</th>
              <th className="px-4 py-3 text-start font-medium">Browser Preview</th>
              <th className="px-4 py-3 text-start font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--asis-border)]">
            {PROTOCOL_SUPPORT_MATRIX.map((row) => (
              <tr key={row.protocol}>
                <td className="px-4 py-3 font-mono font-semibold">{row.protocol}</td>
                <td className="px-4 py-3 font-mono">
                  <span
                    className={
                      row.engine === 'unsupported'
                        ? 'text-[#D64545] dark:text-[#F07070]'
                        : 'text-[var(--asis-accent-fg)]'
                    }
                  >
                    {row.engine}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono">
                  {row.supportedPlatforms.length > 0
                    ? row.supportedPlatforms.join(', ')
                    : 'UNSUPPORTED'}
                </td>
                <td className="px-4 py-3 font-mono text-[var(--asis-text-secondary)]">
                  Parser Only (No TUN)
                </td>
                <td className="px-4 py-3 text-[var(--asis-text-secondary)]">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
