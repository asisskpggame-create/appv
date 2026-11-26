import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Server, ShieldAlert } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonBlock,
  SkeletonList,
  StatusBanner,
} from '../../design-system/components';

interface GatewayHealthResponse {
  service: string;
  apiVersion: string;
  status: string;
  timestamp: string;
  adapters: {
    pasarguard: {
      status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR';
      configuredInstances: Array<{ instanceId: string; label: string }>;
      message: string;
    };
    reseller: {
      status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR';
      message: string;
    };
  };
}

interface VersionResponse {
  platform: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  mandatoryUpdate: boolean;
  optionalUpdate: boolean;
  releaseNotes: string;
}

interface OpenApiSummary {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, { summary?: string }>>;
}

export function GatewayStatusView() {
  const { locale } = usePreferences();
  const isFa = locale === 'fa-IR';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<GatewayHealthResponse | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionResponse | null>(null);
  const [openApi, setOpenApi] = useState<OpenApiSummary | null>(null);

  const fetchGatewayStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, versionRes, openApiRes] = await Promise.all([
        fetch('/api/v1/health'),
        fetch('/api/v1/app/version?platform=web&currentVersion=0.3.0'),
        fetch('/api/v1/openapi.json'),
      ]);

      if (!healthRes.ok || !versionRes.ok || !openApiRes.ok) {
        throw new Error('Gateway endpoints returned a non-OK status.');
      }

      const [healthJson, versionJson, openApiJson] = await Promise.all([
        healthRes.json() as Promise<GatewayHealthResponse>,
        versionRes.json() as Promise<VersionResponse>,
        openApiRes.json() as Promise<OpenApiSummary>,
      ]);

      setHealth(healthJson);
      setVersionInfo(versionJson);
      setOpenApi(openApiJson);
    } catch {
      setError(
        isFa
          ? 'درگاه API کلاینت در دسترس نیست. از اجرای server.ts اطمینان حاصل کنید.'
          : 'Unable to reach /api/v1 gateway endpoints. Ensure server.ts is running.',
      );
    } finally {
      setLoading(false);
    }
  }, [isFa]);

  useEffect(() => {
    void fetchGatewayStatus();
  }, [fetchGatewayStatus]);

  if (loading) {
    return (
      <div className="space-y-8" role="status" aria-busy="true" aria-label="Loading gateway status">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--asis-border)] pb-5">
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-64" />
            <SkeletonBlock className="h-4 w-80" />
          </div>
          <SkeletonBlock className="h-9 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="space-y-3">
            <SkeletonBlock className="h-5 w-44" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-3 w-36" />
          </Card>
          <Card className="space-y-3">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-3 w-44" />
          </Card>
        </div>
        <Card className="space-y-4">
          <SkeletonList rows={4} />
        </Card>
      </div>
    );
  }

  if (error || !health) {
    return (
      <ErrorState
        title={isFa ? 'درگاه API در دسترس نیست' : 'Client API Gateway Unreachable'}
        description={error ?? ''}
        actionLabel={isFa ? 'تلاش مجدد' : 'Retry Connection'}
        onAction={() => void fetchGatewayStatus()}
      />
    );
  }

  const endpointRows = openApi
    ? Object.entries(openApi.paths).flatMap(([path, methods]) =>
        Object.entries(methods).map(([method, meta]) => ({
          method: method.toUpperCase(),
          path: `/api/v1${path}`,
          summary: meta.summary ?? '',
        })),
      )
    : [];

  return (
    <div className="space-y-8 text-start">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--asis-border)] pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isFa ? 'درگاه API کلاینت و آداپتورهای اتصال' : 'Client API Gateway & Upstream Adapters'}
          </h2>
          <p className="mt-1 text-sm text-[var(--asis-text-secondary)]">
            {isFa
              ? 'وضعیت زنده مسیرهای /api/v1 و آماده‌باش آداپتورهای PasarGuard و سیستم نمایندگی'
              : 'Live status from /api/v1 endpoints and integration readiness for PasarGuard and Reseller adapters.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          onClick={() => void fetchGatewayStatus()}
        >
          {isFa ? 'بروزرسانی وضعیت' : 'Refresh Status'}
        </Button>
      </div>

      {/* Adapter Readiness Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[var(--asis-accent-fg)]" aria-hidden="true" />
              <h3 className="text-sm font-semibold">PasarGuard Adapter Registry</h3>
            </div>
            <span className="font-mono text-xs text-[#D97706] dark:text-[#FBBF24]">
              {health.adapters.pasarguard.status}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--asis-text-secondary)]">
            {health.adapters.pasarguard.message}
          </p>
          <p className="font-mono text-xs text-[var(--asis-text-secondary)]">
            {isFa ? 'تعداد پنل‌های پیکربندی‌شده: ' : 'Configured instances: '}
            {health.adapters.pasarguard.configuredInstances.length}
          </p>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#D97706] dark:text-[#FBBF24]" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Reseller Adapter</h3>
            </div>
            <span className="font-mono text-xs text-[#D97706] dark:text-[#FBBF24]">
              {health.adapters.reseller.status}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--asis-text-secondary)]">
            {health.adapters.reseller.message}
          </p>
          {versionInfo && (
            <p className="font-mono text-xs text-[var(--asis-text-secondary)]">
              Min Version: {versionInfo.minimumSupportedVersion} · Latest: {versionInfo.latestVersion}
            </p>
          )}
        </Card>
      </div>

      <StatusBanner
        tone="info"
        title={isFa ? 'قانون شفافیت یکپارچه‌سازی' : 'Honest Integration Boundary'}
        description={
          isFa
            ? 'تا زمان ارائه مستندات API و توکن‌های سرور، مسیرهای متصل به PasarGuard و پنل نمایندگی وضعیت 503 (NOT_CONNECTED) برمی‌گردانند و داده ساختگی تولید نمی‌کنند.'
            : 'Until upstream API schemas and server credentials are provided, routes requiring PasarGuard or Reseller systems explicitly return HTTP 503 (NOT_CONNECTED) without fabricating balances.'
        }
      />

      {/* Live OpenAPI Contract Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--asis-border)] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">
              {isFa ? 'قرارداد OpenAPI 3.1 فعال' : 'Live OpenAPI 3.1 Contract'}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--asis-text-secondary)]">
              {openApi ? `${openApi.info.title} · v${openApi.info.version}` : ''}
            </p>
          </div>
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs font-medium text-[var(--asis-accent-fg)] hover:underline"
          >
            /api/v1/openapi.json
          </a>
        </div>

        {endpointRows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No endpoints documented"
              description="OpenAPI specification returned empty paths."
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--asis-border)]">
            {endpointRows.map((row) => (
              <div
                key={`${row.method}:${row.path}`}
                className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-semibold text-[var(--asis-accent-fg)] w-14 shrink-0">
                    {row.method}
                  </span>
                  <span className="font-mono text-xs truncate">{row.path}</span>
                </div>
                <span className="text-xs text-[var(--asis-text-secondary)]">
                  {row.summary}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
