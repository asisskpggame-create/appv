import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Compass,
  LifeBuoy,
  Languages,
  Moon,
  Power,
  Shuffle,
  ShieldCheck,
  Network,
  RefreshCw,
  ServerCog,
  Settings,
  ShieldAlert,
  Sliders,
  Split,
  Wifi,
} from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import type { LocaleCode } from '../../design-system/tokens';
import {
  Button,
  Card,
  Input,
  SegmentedControl,
  StatusBanner,
  ToggleSwitch,
} from '../../design-system/components';
import type {
  AdvancedConnectionPolicy,
  InstalledAppEntry,
  TargetPlatform,
} from '../../engine';
import { KillSwitchSettings } from './KillSwitchSettings';
import { SplitTunnelingAppSelector } from './SplitTunnelingAppSelector';

interface SettingsViewProps {
  platform: TargetPlatform;
  policy: AdvancedConnectionPolicy;
  onPolicyChange: (next: AdvancedConnectionPolicy) => void;
  loadInstalledApplications?: () => Promise<InstalledAppEntry[]>;
  /** Optional shortcut to the support screen (phone bottom bar has no Support tab). */
  onNavigateToSupport?: () => void;
}

interface AppUpdateResponse {
  platform: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  mandatoryUpdate: boolean;
  optionalUpdate: boolean;
  releaseNotes: string;
}

const CUSTOM_APPS_STORAGE_KEY = 'asis_split_tunnel_custom_apps_v1';

function loadStoredCustomApps(): InstalledAppEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_APPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is InstalledAppEntry =>
        Boolean(item && typeof item === 'object' && typeof (item as InstalledAppEntry).id === 'string'),
    );
  } catch {
    return [];
  }
}

export function SettingsView({
  platform,
  policy,
  onPolicyChange,
  loadInstalledApplications,
  onNavigateToSupport,
}: SettingsViewProps) {
  const { locale, setLocale } = usePreferences();
  const isFa = locale === 'fa-IR';
  const isWeb = platform === 'web';

  const [showAdvanced, setShowAdvanced] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 });
  }, [showAdvanced]);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateResponse | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const [nativeApps, setNativeApps] = useState<InstalledAppEntry[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [customApps, setCustomApps] = useState<InstalledAppEntry[]>(() => loadStoredCustomApps());

  const refreshNativeApps = useCallback(async () => {
    if (!loadInstalledApplications) return;
    setLoadingApps(true);
    try {
      const list = await loadInstalledApplications();
      setNativeApps(Array.isArray(list) ? list : []);
    } catch {
      setNativeApps([]);
    } finally {
      setLoadingApps(false);
    }
  }, [loadInstalledApplications]);

  useEffect(() => {
    if (!isWeb && loadInstalledApplications) {
      void refreshNativeApps();
    }
  }, [isWeb, loadInstalledApplications, refreshNativeApps]);

  const combinedApplications = useMemo(() => {
    const seen = new Set<string>();
    const merged: InstalledAppEntry[] = [];
    for (const app of [...customApps, ...nativeApps]) {
      if (!seen.has(app.id)) {
        seen.add(app.id);
        merged.push(app);
      }
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [customApps, nativeApps]);

  const handleAddCustomApp = (entry: InstalledAppEntry) => {
    setCustomApps((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)];
      try {
        window.localStorage.setItem(CUSTOM_APPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleRemoveCustomApp = (appId: string) => {
    setCustomApps((prev) => {
      const next = prev.filter((item) => item.id !== appId);
      try {
        window.localStorage.setItem(CUSTOM_APPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
    if (policy.splitTunnelingAppIds.includes(appId)) {
      onPolicyChange({
        ...policy,
        splitTunnelingAppIds: policy.splitTunnelingAppIds.filter((id) => id !== appId),
      });
    }
  };

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch(`/api/v1/app/version?platform=${platform}&currentVersion=0.3.0`);
      if (res.ok) {
        setUpdateInfo((await res.json()) as AppUpdateResponse);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const splitModeSummary = (() => {
    switch (policy.splitTunnelingMode) {
      case 'all':
        return isFa ? 'تمام ترافیک' : 'All Traffic';
      case 'bypass_lan':
        return isFa ? 'عبور شبکه محلی' : 'Bypass LAN';
      case 'bypass_iran':
        return isFa ? 'عبور دامنه داخلی' : 'Bypass Domestic';
      case 'custom':
        return isFa
          ? `برنامه‌ای (${policy.splitTunnelingAppIds.length})`
          : `Per-App (${policy.splitTunnelingAppIds.length})`;
    }
  })();

  // Sub-page: only for users who need these controls.
  const advancedPage = (
    <div className="asis-view-enter space-y-5 text-start md:space-y-8">
      <button
        type="button"
        onClick={() => setShowAdvanced(false)}
        className="group -ms-1 inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-[var(--asis-text-primary)] transition-all duration-150 hover:bg-[var(--asis-primary-soft)] active:scale-[0.97] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)]"
      >
        <ChevronRight
          className={`h-5 w-5 transition-transform duration-150 ${isFa ? 'group-hover:translate-x-0.5' : 'rotate-180 group-hover:-translate-x-0.5'}`}
          aria-hidden="true"
        />
        {isFa ? 'تنظیمات' : 'Settings'}
      </button>
      <h2 className="text-xl font-semibold tracking-tight">{isFa ? 'تنظیمات پیشرفته' : 'Advanced'}</h2>

      {/* Split Tunneling & App Selection */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--asis-border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {isFa ? 'تونل‌سازی تفکیکی (Split Tunneling)' : 'Split Tunneling'}
              </h3>
              <p className="text-xs text-[var(--asis-text-secondary)]">
                {isFa
                  ? 'مدیریت مسیر ترافیک شبکه محلی، دامنه و برنامه‌های منتخب'
                  : 'Define how LAN routes, domestic traffic, and specific applications use the VPN tunnel.'}
              </p>
            </div>
          </div>

          <SegmentedControl<AdvancedConnectionPolicy['splitTunnelingMode']>
            ariaLabel={isFa ? 'حالت تونل‌سازی تفکیکی' : 'Split tunneling mode'}
            value={policy.splitTunnelingMode}
            onChange={(splitTunnelingMode) => onPolicyChange({ ...policy, splitTunnelingMode })}
            options={[
              { value: 'all', label: isFa ? 'همه ترافیک' : 'All Traffic' },
              { value: 'bypass_lan', label: isFa ? 'عبور LAN' : 'Bypass LAN' },
              { value: 'bypass_iran', label: isFa ? 'عبور ایران' : 'Bypass Domestic' },
              { value: 'custom', label: isFa ? 'انتخاب برنامه‌ها' : 'Per-App' },
            ]}
          />
        </div>

        <SplitTunnelingAppSelector
          platform={platform}
          splitTunnelingActive={policy.splitTunnelingMode === 'custom'}
          ruleMode={policy.splitTunnelingRuleMode}
          selectedAppIds={policy.splitTunnelingAppIds}
          applications={combinedApplications}
          loadingApps={loadingApps}
          onActivateSplitTunneling={() =>
            onPolicyChange({ ...policy, splitTunnelingMode: 'custom' })
          }
          onRuleModeChange={(splitTunnelingRuleMode) =>
            onPolicyChange({ ...policy, splitTunnelingRuleMode })
          }
          onSelectedAppIdsChange={(splitTunnelingAppIds) =>
            onPolicyChange({ ...policy, splitTunnelingAppIds })
          }
          onAddCustomApp={handleAddCustomApp}
          onRemoveCustomApp={handleRemoveCustomApp}
          onRefreshNativeApps={loadInstalledApplications ? () => void refreshNativeApps() : undefined}
        />
      </Card>

      {/* Advanced Connection Settings */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 border-b border-[var(--asis-border)] pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
            <Sliders className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold">
              {isFa ? 'تنظیمات پیشرفته اتصال' : 'Advanced Tunnel Settings'}
            </h3>
            <p className="text-xs text-[var(--asis-text-secondary)]">
              {isFa
                ? 'پیکربندی DNS، اندازه بسته MTU، پورت پراکسی محلی و حفاظت از نشت ترافیک'
                : 'Configure DNS resolvers, MTU sizing, local proxy bindings, and leak protection.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Input
            label={isFa ? 'سرور DNS سفارشی' : 'Custom DNS Server'}
            value={policy.customDns}
            onChange={(e) => onPolicyChange({ ...policy, customDns: e.target.value })}
            hint="e.g. 1.1.1.1 or 8.8.8.8"
          />

          <Input
            label={isFa ? 'مقدار MTU تونل' : 'Tunnel MTU'}
            type="number"
            min={1280}
            max={1500}
            value={String(policy.mtu)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) {
                onPolicyChange({ ...policy, mtu: Math.max(1280, Math.min(1500, next)) });
              }
            }}
            hint="Recommended: 1400 (1280–1500)"
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{isFa ? 'مدیریت IPv6' : 'IPv6 Handling'}</label>
            <SegmentedControl<'disable' | 'auto' | 'prefer'>
              ariaLabel="IPv6 handling"
              value={policy.ipv6Mode}
              onChange={(ipv6Mode) => onPolicyChange({ ...policy, ipv6Mode })}
              options={[
                { value: 'disable', label: isFa ? 'غیرفعال' : 'Disable' },
                { value: 'auto', label: isFa ? 'خودکار' : 'Auto' },
                { value: 'prefer', label: isFa ? 'اولویت' : 'Prefer' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{isFa ? 'حالت مسیریابی' : 'Routing Mode'}</label>
            <SegmentedControl<'rule' | 'global'>
              ariaLabel="Routing mode"
              value={policy.routingMode}
              onChange={(routingMode) => onPolicyChange({ ...policy, routingMode })}
              options={[
                { value: 'rule', label: isFa ? 'مبتنی بر قوانین' : 'Rule-based' },
                { value: 'global', label: isFa ? 'سراسری (Global)' : 'Global TUN' },
              ]}
            />
          </div>

          <Input
            label={isFa ? 'مهلت اتصال (ثانیه)' : 'Connection Timeout (sec)'}
            type="number"
            min={5}
            max={60}
            value={String(policy.connectionTimeoutSec)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (Number.isFinite(val)) {
                onPolicyChange({
                  ...policy,
                  connectionTimeoutSec: Math.max(5, Math.min(60, val)),
                });
              }
            }}
          />

          <Input
            label={isFa ? 'پورت پراکسی محلی SOCKS5' : 'Local SOCKS5 Proxy Port'}
            type="number"
            min={1024}
            max={65535}
            value={String(policy.localSocksPort)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (Number.isFinite(val)) {
                onPolicyChange({ ...policy, localSocksPort: val });
              }
            }}
          />
        </div>

        {/* Platform-gated capabilities matrix (flat hairline dividers + ToggleSwitch) */}
        <div className="divide-y divide-[var(--asis-border)] border-t border-[var(--asis-border)]">
          <KillSwitchSettings
            platform={platform}
            enabled={policy.killSwitch}
            allowLocalNetwork={policy.allowLocalNetwork}
            onChange={(killSwitch) => onPolicyChange({ ...policy, killSwitch })}
          />

          <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
                <Network className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">
                  {isFa ? 'دسترسی به شبکه محلی (LAN)' : 'Local Network Access (LAN Bypass)'}
                </p>
                <p className="text-xs text-[var(--asis-text-secondary)]">
                  {isFa ? 'دور زدن تونل برای چاپگرها و دستگاه‌های محلی' : 'Keep RFC1918 LAN routes direct'}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={policy.allowLocalNetwork}
              onChange={(allowLocalNetwork) =>
                onPolicyChange({ ...policy, allowLocalNetwork })
              }
              ariaLabel="Local Network Access"
            />
          </div>
        </div>
      </Card>

    </div>
  );
  if (showAdvanced) return advancedPage;

  return (
    <div className="space-y-5 text-start md:space-y-8">
      <div className="hidden items-center gap-3.5 border-b border-[var(--asis-border)] pb-5 md:flex">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
          <Settings className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isFa ? 'تنظیمات و پیکربندی پیشرفته' : 'Settings & Advanced Connection Policy'}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--asis-text-secondary)]">
            {isFa
              ? 'تنظیمات ظاهر، زبان، تونل‌سازی تفکیکی برنامه‌ها و پارامترهای اتصال'
              : 'Language, appearance, per-app split tunneling, and platform-gated tunnel controls.'}
          </p>
        </div>
      </div>

      {/* Settings, grouped by what they do */}
      {(() => {
        const Row = ({
          icon: Icon,
          title,
          hint,
          children,
        }: {
          icon: React.ComponentType<{ className?: string }>;
          title: string;
          hint?: string;
          children: React.ReactNode;
        }) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--asis-surface-2)] text-[var(--asis-text-secondary)]">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                {hint && <span className="block text-xs leading-5 text-[var(--asis-text-secondary)]">{hint}</span>}
              </span>
            </span>
            <span className="shrink-0">{children}</span>
          </div>
        );
        const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
          <section className="space-y-2">
            <h3 className="px-1 text-[13px] font-semibold text-[var(--asis-text-secondary)]">{title}</h3>
            <Card padding="none" className="divide-y divide-[var(--asis-border)] overflow-hidden">
              {children}
            </Card>
          </section>
        );
        return (
          <>
            <Group title={isFa ? 'عمومی' : 'General'}>
              <Row icon={Languages} title={isFa ? 'زبان برنامه' : 'Language'}>
                <SegmentedControl<LocaleCode>
                  ariaLabel="Language"
                  value={locale}
                  onChange={setLocale}
                  options={[
                    { value: 'fa-IR', label: 'فارسی' },
                    { value: 'en-US', label: 'English' },
                  ]}
                />
              </Row>
            </Group>

            <Group title={isFa ? 'اتصال' : 'Connection'}>
              <Row
                icon={Power}
                title={isFa ? 'اتصال مجدد خودکار' : 'Auto reconnect'}
                hint={isFa ? 'اگر اتصال قطع شد، دوباره وصل می‌شود' : 'Reconnects if the connection drops'}
              >
                <ToggleSwitch
                  ariaLabel={isFa ? 'اتصال مجدد خودکار' : 'Auto reconnect'}
                  checked={policy.autoReconnect}
                  onChange={(next) => onPolicyChange({ ...policy, autoReconnect: next })}
                />
              </Row>
              <Row
                icon={Power}
                title={isFa ? 'اتصال هنگام باز شدن برنامه' : 'Connect on launch'}
                hint={isFa ? 'با باز کردن برنامه خودکار وصل می‌شود' : 'Connects as soon as the app opens'}
              >
                <ToggleSwitch
                  ariaLabel={isFa ? 'اتصال هنگام باز شدن برنامه' : 'Connect on launch'}
                  checked={policy.autoConnect === true}
                  onChange={(next) => onPolicyChange({ ...policy, autoConnect: next })}
                />
              </Row>
              <Row
                icon={Shuffle}
                title={isFa ? 'تعویض خودکار سرور' : 'Auto-switch servers'}
                hint={isFa ? 'اگر سرور کند شد، به سرور بهتر می‌رود' : 'Moves to a faster server when yours slows down'}
              >
                <ToggleSwitch
                  ariaLabel={isFa ? 'تعویض خودکار سرور' : 'Auto-switch servers'}
                  checked={policy.autoSwitch === true}
                  onChange={(next) => onPolicyChange({ ...policy, autoSwitch: next })}
                />
              </Row>
            </Group>

            <Group title={isFa ? 'امنیت و شبکه' : 'Security & network'}>
              <Row
                icon={ShieldCheck}
                title="Kill Switch"
                hint={isFa ? 'با قطع VPN اینترنت هم قطع می‌شود' : 'Blocks internet if the VPN drops'}
              >
                <ToggleSwitch
                  ariaLabel="Kill Switch"
                  checked={policy.killSwitch}
                  disabled={isWeb}
                  onChange={(next) => onPolicyChange({ ...policy, killSwitch: next })}
                />
              </Row>
              <Row icon={Split} title="Split Tunneling">
                <span className="font-mono text-xs text-[var(--asis-text-secondary)]">{splitModeSummary}</span>
              </Row>
              <Row icon={ServerCog} title="DNS">
                <span className="font-mono text-xs text-[var(--asis-text-secondary)]" dir="ltr">
                  {policy.customDns || '1.1.1.1'}
                </span>
              </Row>
            </Group>

            {onNavigateToSupport && (
              <Group title={isFa ? 'کمک' : 'Help'}>
                <button
                  type="button"
                  onClick={onNavigateToSupport}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 text-start transition-colors hover:bg-[var(--asis-surface-2)]"
                >
                  <Row icon={LifeBuoy} title={isFa ? 'پشتیبانی و راهنما' : 'Support & help'}>
                    <ChevronRight
                      className={`h-4 w-4 text-[var(--asis-text-secondary)] ${isFa ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </Row>
                </button>
              </Group>
            )}
          </>
        );
      })()}

      {/* Platform Limitation Notice */}
      {isWeb && (
        <StatusBanner
          tone="info"
          title={
            isFa
              ? 'محدودیت سیستم‌عامل در محیط وب'
              : 'Platform Capability Enforcement (Web Preview)'
          }
          description={
            isFa
              ? 'تنظیمات سطح کرنل مانند Kill Switch و اسکن خودکار برنامه‌های نصب‌شده فقط در نسخه‌های بومی اندروید، iOS و ویندوز فعال می‌شوند.'
              : 'Kernel-level controls such as Kill Switch and automatic OS app scanning activate only on native Android, iOS, or Windows builds.'
          }
        />
      )}

      {/* Advanced settings: a separate sub-page, opened from this row */}
      <button
        type="button"
        onClick={() => setShowAdvanced(true)}
        className="asis-glass group flex w-full items-center justify-between gap-3 rounded-3xl px-4 py-3.5 text-start transition-all duration-200 hover:brightness-110 active:scale-[0.985] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)]"
      >
        <span className="flex items-center gap-3">
          <Sliders className="h-4 w-4 text-[var(--asis-accent-fg)]" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium">{isFa ? 'تنظیمات پیشرفته' : 'Advanced'}</span>
            <span className="block text-xs text-[var(--asis-text-secondary)]">
              {isFa ? 'تونل‌سازی تفکیکی، DNS، MTU و سیاست اتصال' : 'Split tunneling, DNS, MTU and connection policy'}
            </span>
          </span>
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-[var(--asis-text-secondary)] transition-transform duration-200 group-hover:translate-x-0.5 ${isFa ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Update Check & About */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            {isFa ? 'نسخه برنامه و بروزرسانی' : 'Application Version & Updates'}
          </h3>
          <p className="mt-1 font-mono text-xs text-[var(--asis-text-secondary)]">
            {isFa
              ? `ASiS VPN · نسخه 0.3.0 · پلتفرم: ${platform}`
              : `ASiS VPN Client · v0.3.0 · Platform: ${platform}`}
          </p>
          {updateInfo && (
            <p className="mt-1 text-xs text-[var(--asis-accent-fg)]">
              {isFa
                ? `آخرین نسخه: ${updateInfo.latestVersion} · حداقل نسخه پشتیبانی: ${updateInfo.minimumSupportedVersion} · ${
                    updateInfo.mandatoryUpdate ? 'نیازمند بروزرسانی اجباری' : 'به‌روز است'
                  }`
                : `Latest: ${updateInfo.latestVersion} · Min Supported: ${updateInfo.minimumSupportedVersion} · ${
                    updateInfo.mandatoryUpdate ? 'Mandatory Update' : 'Up to date'
                  }`}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={checkingUpdate}
          icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          onClick={() => void checkUpdates()}
        >
          {isFa ? 'بررسی بروزرسانی' : 'Check for Updates'}
        </Button>
      </Card>
    </div>
  );
}
