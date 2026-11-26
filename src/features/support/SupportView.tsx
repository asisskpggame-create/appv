import React, { useState } from 'react';
import { CheckCircle2, Copy, LifeBuoy, Stethoscope } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import { Button, Card, SkeletonList, StatusBanner } from '../../design-system/components';
import type { VpnEngineAdapter } from '../../engine';
import type { ServerCatalogEntry } from '../servers';
import type { SubscriptionRecord } from '../subscriptions';

import type { AuthSession } from '../auth';

interface SupportViewProps {
  engine: VpnEngineAdapter;
  session?: AuthSession | null;
  activeSubscription: SubscriptionRecord | null;
  selectedServer: ServerCatalogEntry | null;
}

interface DiagnosticCheckItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export function SupportView({
  engine,
  session = null,
  activeSubscription,
  selectedServer,
}: SupportViewProps) {
  const { locale } = usePreferences();
  const isFa = locale === 'fa-IR';

  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<DiagnosticCheckItem[]>([]);
  const [copied, setCopied] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    const results: DiagnosticCheckItem[] = [];

    // 1. Gateway Health Check
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        const data = (await res.json()) as {
          adapters?: { pasarguard?: { status?: string }; reseller?: { status?: string } };
        };
        results.push({
          id: 'gateway',
          label: isFa ? 'وضعیت درگاه ASiS Client API' : 'ASiS Client API Gateway',
          status: 'pass',
          detail: `HTTP 200 · PasarGuard: ${data.adapters?.pasarguard?.status ?? 'UNKNOWN'} · Reseller: ${data.adapters?.reseller?.status ?? 'UNKNOWN'}`,
        });
      } else {
        results.push({
          id: 'gateway',
          label: 'ASiS Client API Gateway',
          status: 'fail',
          detail: `HTTP ${res.status}`,
        });
      }
    } catch {
      results.push({
        id: 'gateway',
        label: 'ASiS Client API Gateway',
        status: 'fail',
        detail: 'Gateway unreachable.',
      });
    }

    // 2. Engine Runtime Check
    const engDiag = engine.getDiagnostics();
    results.push({
      id: 'engine',
      label: isFa ? 'موتور بومی VPN' : 'VPN Engine Runtime',
      status: engDiag.nativeBridgeAvailable ? 'pass' : 'warn',
      detail: engDiag.nativeBridgeAvailable
        ? `Native bridge active on ${engDiag.platform}`
        : 'Browser environment: TUN interface requires Android/iOS/Windows native app.',
    });

    // 3. App Version & Update Policy Check
    try {
      const verRes = await fetch(`/api/v1/app/version?platform=${engine.platform}&currentVersion=0.3.0`);
      if (verRes.ok) {
        const ver = (await verRes.json()) as {
          latestVersion: string;
          mandatoryUpdate: boolean;
        };
        results.push({
          id: 'version',
          label: isFa ? 'بررسی نسخه کلاینت' : 'Client Version Policy',
          status: ver.mandatoryUpdate ? 'warn' : 'pass',
          detail: `Latest: v${ver.latestVersion} · Mandatory update: ${ver.mandatoryUpdate ? 'Yes' : 'No'}`,
        });
      }
    } catch {
      // Ignore optional version failure if gateway already failed
    }

    // 4. Active Subscription & Server Check (redacts raw URLs)
    results.push({
      id: 'subscription',
      label: isFa ? 'اعتبارسنجی اشتراک و سرور انتخابی' : 'Selected Subscription & Server',
      status: activeSubscription && selectedServer ? 'pass' : 'warn',
      detail: activeSubscription
        ? `Subscription "${activeSubscription.name}" (${activeSubscription.endpoints.length} endpoints) · Server: ${selectedServer?.name ?? 'None selected'}`
        : 'No active subscription selected.',
    });

    // 5. Authenticated Support Channel Check (when signed in)
    if (session?.tokens.accessToken) {
      try {
        const supRes = await fetch('/api/v1/support', {
          headers: { Authorization: `Bearer ${session.tokens.accessToken}` },
        });
        if (supRes.ok) {
          const sup = (await supRes.json()) as {
            integrationStatus?: string;
            ticketEndpointAvailable?: boolean;
          };
          results.push({
            id: 'support-channel',
            label: isFa ? 'کانال پشتیبانی ارائه‌دهنده' : 'Provider Support Channel',
            status: sup.ticketEndpointAvailable ? 'pass' : 'warn',
            detail: `Reseller support: ${sup.integrationStatus ?? 'NOT_CONNECTED'} · Ticket endpoint: ${sup.ticketEndpointAvailable ? 'Available' : 'Pending'}`,
          });
        }
      } catch {
        // Ignore transient check errors
      }
    }

    setChecks(results);
    setRunning(false);
  };

  const handleCopyReport = async () => {
    const redactedReport = JSON.stringify(
      {
        app: 'ASiS VPN',
        generatedAt: new Date().toISOString(),
        platform: engine.platform,
        checks,
        note: 'Sensitive URLs, passwords, and tokens are strictly redacted.',
      },
      null,
      2,
    );
    await navigator.clipboard?.writeText(redactedReport).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const faqs = isFa
    ? [
        {
          q: 'چرا اتصال VPN در پیش‌نمایش وب برقرار نمی‌شود؟',
          a: 'مرورگرهای وب دسترسی به ساخت اینترفیس شبکه TUN ندارند. اتصال واقعی توسط ماژول‌های بومی Android (VpnService)، iOS (NEPacketTunnelProvider) و Windows (Wintun) انجام می‌شود.',
        },
        {
          q: 'چگونه اشتراک خود را اضافه کنم؟',
          a: 'از بخش اشتراک‌ها می‌توانید با لینک HTTPS، کلیپ‌بورد، تصویر QR یا فایل کانفیگ اشتراک خود را وارد کنید.',
        },
      ]
    : [
        {
          q: 'Why does Connect report an unsupported runtime inside a web browser?',
          a: 'Web browsers cannot create OS-level TUN interfaces. Real encrypted tunnels run through the native Android (VpnService), iOS (NEPacketTunnelProvider), and Windows (Wintun + sing-box) engines.',
        },
        {
          q: 'How are my subscription URLs protected?',
          a: 'Subscription URLs are validated for HTTPS-only, deduplicated via SHA-256 hashes, and never written to client diagnostics or logs.',
        },
      ];

  return (
    <div className="space-y-8 text-start">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--asis-border)] pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isFa ? 'پشتیبانی و عیب‌یابی اتصال' : 'Support & Connection Diagnostics'}
          </h2>
          <p className="mt-1 text-sm text-[var(--asis-text-secondary)]">
            {isFa
              ? 'اجرای بررسی‌های تشخیصی بدون افشای لینک‌های اشتراک یا اطلاعات حساس'
              : 'Run diagnostics and review troubleshooting guides without exposing sensitive subscription URLs.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {checks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={copied ? <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
              onClick={() => void handleCopyReport()}
            >
              {copied ? (isFa ? 'کپی شد' : 'Copied') : isFa ? 'کپی گزارش امن' : 'Copy Redacted Report'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={running}
            icon={<Stethoscope className="w-4 h-4" aria-hidden="true" />}
            onClick={() => void runDiagnostics()}
          >
            {isFa ? 'اجرای عیب‌یابی' : 'Run Diagnostics'}
          </Button>
        </div>
      </div>

      {running ? (
        <Card padding="sm">
          <SkeletonList rows={4} />
        </Card>
      ) : checks.length > 0 ? (
        <Card padding="none" className="divide-y divide-[var(--asis-border)]">
          {checks.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 text-sm">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="font-mono text-xs text-[var(--asis-text-secondary)]">{item.detail}</p>
              </div>
              <span
                className={`font-mono text-xs font-semibold ${
                  item.status === 'pass'
                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                    : item.status === 'warn'
                      ? 'text-[#D97706] dark:text-[#FBBF24]'
                      : 'text-[#DC2626] dark:text-[#F87171]'
                }`}
              >
                {item.status.toUpperCase()}
              </span>
            </div>
          ))}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-[var(--asis-accent-fg)]" aria-hidden="true" />
          <h3 className="text-base font-semibold">
            {isFa ? 'پرسش‌های متداول و راهنما' : 'Frequently Asked Questions'}
          </h3>
        </div>
        <div className="divide-y divide-[var(--asis-border)]">
          {faqs.map((faq) => (
            <div key={faq.q} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
              <p className="text-sm font-semibold">{faq.q}</p>
              <p className="text-xs leading-relaxed text-[var(--asis-text-secondary)]">{faq.a}</p>
            </div>
          ))}
        </div>
      </Card>

      <StatusBanner
        tone="info"
        title={isFa ? 'پشتیبانی و ارسال تیکت' : 'Support Contact & Ticket Endpoint'}
        description={
          isFa
            ? 'اطلاعات تماس و ثبت تیکت پس از اتصال آداپتور سیستم نمایندگی از مسیر /api/v1/support دریافت می‌شود.'
            : 'Support contact channels and ticket submission populate dynamically from /api/v1/support once the Reseller adapter is connected.'
        }
      />
    </div>
  );
}
