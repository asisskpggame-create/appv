import React, { useMemo, useState } from 'react';
import {
  AppWindow,
  Cpu,
  Globe,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  Button,
  Dialog,
  EmptyState,
  Input,
  SegmentedControl,
  SkeletonList,
  StatusBanner,
  ToggleSwitch,
} from '../../design-system/components';
import type {
  InstalledAppCategory,
  InstalledAppEntry,
  SplitTunnelingRuleMode,
  TargetPlatform,
} from '../../engine';
import {
  filterInstalledApps,
  isAppRoutedThroughVpn,
  setAllAppsVpnAccess,
  toggleAppVpnAccess,
  validateCustomAppRule,
  type AppListFilterMode,
} from './splitTunnelingUtils';

interface SplitTunnelingAppSelectorProps {
  platform: TargetPlatform;
  splitTunnelingActive: boolean;
  ruleMode: SplitTunnelingRuleMode;
  selectedAppIds: string[];
  applications: InstalledAppEntry[];
  loadingApps?: boolean;
  onActivateSplitTunneling: () => void;
  onRuleModeChange: (mode: SplitTunnelingRuleMode) => void;
  onSelectedAppIdsChange: (nextIds: string[]) => void;
  onAddCustomApp: (entry: InstalledAppEntry) => void;
  onRemoveCustomApp: (appId: string) => void;
  onRefreshNativeApps?: () => void;
}

const CATEGORY_ICONS: Record<
  InstalledAppCategory,
  React.ComponentType<{ className?: string }>
> = {
  browser: Globe,
  messaging: MessageSquare,
  media: Play,
  developer: Terminal,
  system: Cpu,
  other: AppWindow,
};

const CATEGORY_LABELS: Record<InstalledAppCategory, { en: string; fa: string }> = {
  browser: { en: 'Browser', fa: 'مرورگر' },
  messaging: { en: 'Messaging', fa: 'پیام‌رسان' },
  media: { en: 'Media & Streaming', fa: 'رسانه و استریم' },
  developer: { en: 'Developer', fa: 'توسعه‌دهنده' },
  system: { en: 'System', fa: 'سیستمی' },
  other: { en: 'Application', fa: 'برنامه' },
};

const IDENTIFIER_TEMPLATES: Array<{
  label: string;
  name: string;
  identifier: string;
  category: InstalledAppCategory;
}> = [
  {
    label: 'Telegram',
    name: 'Telegram',
    identifier: 'org.telegram.messenger',
    category: 'messaging',
  },
  {
    label: 'WhatsApp',
    name: 'WhatsApp',
    identifier: 'com.whatsapp',
    category: 'messaging',
  },
  {
    label: 'Chrome',
    name: 'Google Chrome',
    identifier: 'com.android.chrome',
    category: 'browser',
  },
  {
    label: 'Discord (Win)',
    name: 'Discord',
    identifier: 'discord.exe',
    category: 'messaging',
  },
  {
    label: 'Steam (Win)',
    name: 'Steam',
    identifier: 'steam.exe',
    category: 'media',
  },
];

export function SplitTunnelingAppSelector({
  platform,
  splitTunnelingActive,
  ruleMode,
  selectedAppIds,
  applications,
  loadingApps = false,
  onActivateSplitTunneling,
  onRuleModeChange,
  onSelectedAppIdsChange,
  onAddCustomApp,
  onRemoveCustomApp,
  onRefreshNativeApps,
}: SplitTunnelingAppSelectorProps) {
  const { locale } = usePreferences();
  const isFa = locale === 'fa-IR';
  const isWeb = platform === 'web';
  const isIos = platform === 'ios';

  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<AppListFilterMode>('all');
  const [categoryFilter, setCategoryFilter] = useState<InstalledAppCategory | 'all'>('all');
  const [showSystemApps, setShowSystemApps] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIdentifier, setCustomIdentifier] = useState('');
  const [customCategory, setCustomCategory] = useState<InstalledAppCategory>('other');
  const [formError, setFormError] = useState<string | null>(null);

  const hasSystemApps = useMemo(
    () => applications.some((app) => Boolean(app.isSystemApp)),
    [applications],
  );

  const filteredApps = useMemo(
    () =>
      filterInstalledApps(applications, {
        query,
        filterMode,
        categoryFilter,
        showSystemApps,
        ruleMode,
        selectedAppIds,
      }),
    [applications, query, filterMode, categoryFilter, showSystemApps, ruleMode, selectedAppIds],
  );

  const summary = useMemo(() => {
    let vpnCount = 0;
    let bypassedCount = 0;
    for (const app of applications) {
      if (isAppRoutedThroughVpn(app.id, ruleMode, selectedAppIds)) {
        vpnCount += 1;
      } else {
        bypassedCount += 1;
      }
    }
    return { total: applications.length, vpnCount, bypassedCount };
  }, [applications, ruleMode, selectedAppIds]);

  const handleToggleApp = (appId: string, nextEnableVpn: boolean) => {
    if (!splitTunnelingActive) {
      onActivateSplitTunneling();
    }
    onSelectedAppIdsChange(
      toggleAppVpnAccess(appId, nextEnableVpn, ruleMode, selectedAppIds),
    );
  };

  const handleBulkToggle = (enableVpn: boolean) => {
    if (filteredApps.length === 0) return;
    if (!splitTunnelingActive) {
      onActivateSplitTunneling();
    }
    onSelectedAppIdsChange(
      setAllAppsVpnAccess(filteredApps, enableVpn, ruleMode, selectedAppIds),
    );
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCustomAppRule(customName, customIdentifier, customCategory);
    if (!validation.valid || !validation.entry) {
      if (validation.errorCode === 'NAME_REQUIRED') {
        setFormError(
          isFa ? 'نام برنامه باید حداقل ۲ کاراکتر باشد.' : 'Enter an application name (min 2 chars).',
        );
      } else if (validation.errorCode === 'IDENTIFIER_REQUIRED') {
        setFormError(
          isFa
            ? 'شناسه بسته یا نام فایل اجرایی الزامی است.'
            : 'Enter a package ID or executable name.',
        );
      } else {
        setFormError(
          isFa
            ? 'فرمت شناسه نامعتبر است (مثال: com.whatsapp یا chrome.exe).'
            : 'Invalid identifier format (e.g. com.whatsapp or chrome.exe).',
        );
      }
      return;
    }

    const exists = applications.some((app) => app.id === validation.entry!.id);
    if (exists) {
      setFormError(
        isFa
          ? 'این شناسه برنامه قبلاً اضافه شده است.'
          : 'This application identifier is already in the list.',
      );
      return;
    }

    onAddCustomApp(validation.entry);
    if (!splitTunnelingActive) {
      onActivateSplitTunneling();
    }
    onSelectedAppIdsChange(Array.from(new Set([...selectedAppIds, validation.entry.id])));

    setCustomName('');
    setCustomIdentifier('');
    setCustomCategory('other');
    setFormError(null);
    setAddOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Section Header & Primary Action */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--asis-text-primary)]">
              {isFa ? 'انتخاب برنامه‌ها (Per-App Split Tunneling)' : 'App Selection'}
            </h4>
            {summary.total > 0 && (
              <span className="font-mono text-xs text-[var(--asis-text-secondary)]">
                {isFa
                  ? `· ${summary.vpnCount} از VPN · ${summary.bypassedCount} مستقیم`
                  : `· ${summary.vpnCount} VPN · ${summary.bypassedCount} Direct`}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--asis-text-secondary)]">
            {isFa
              ? 'مشخص کنید کدام برنامه‌های نصب‌شده از تونل VPN عبور کنند و کدام بدون فیلترشکن متصل شوند.'
              : 'Toggle VPN tunnel routing individually per installed application or executable identifier.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onRefreshNativeApps && !isWeb && !isIos && (
            <Button
              variant="outline"
              size="sm"
              loading={loadingApps}
              icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={onRefreshNativeApps}
            >
              {isFa ? 'اسکن برنامه‌ها' : 'Scan Apps'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={() => {
              setFormError(null);
              setAddOpen(true);
            }}
          >
            {isFa ? 'افزودن برنامه' : 'Add App Rule'}
          </Button>
        </div>
      </div>

      {/* Mode Activation Banner (clean hairline surface, zero nested border clutter) */}
      {!splitTunnelingActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--asis-surface-2)] px-4 py-3 text-xs">
          <span className="text-[var(--asis-text-secondary)]">
            {isFa
              ? 'برای اعمال قوانین انتخاب برنامه هنگام اتصال، حالت تونل‌سازی تفکیکی را روی «انتخاب برنامه‌ها» قرار دهید.'
              : 'Switch Split Tunneling Mode above to "Per-App" to enforce application rules during tunnel connection.'}
          </span>
          <Button variant="outline" size="sm" onClick={onActivateSplitTunneling}>
            {isFa ? 'فعال‌سازی حالت برنامه‌ای' : 'Enable Per-App Mode'}
          </Button>
        </div>
      )}

      {isIos && (
        <StatusBanner
          tone="info"
          title={
            isFa
              ? 'محدودیت سیستم‌عامل iOS برای تفکیک برنامه‌ای'
              : 'iOS Per-App Limitation'
          }
          description={
            isFa
              ? 'سیستم‌عامل iOS برای کلاینت‌های عمومی فقط از مسیریابی دامنه و IP پشتیبانی می‌کند؛ قوانین برنامه‌ای روی اندروید و ویندوز اعمال می‌شوند.'
              : 'Consumer iOS NEPacketTunnelProvider profiles route by domain and IP rules; per-app split tunneling applies on Android and Windows.'
          }
        />
      )}

      {/* Flat Hairline Toolbar */}
      <div className="space-y-3 border-t border-[var(--asis-border)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-medium text-[var(--asis-text-secondary)]">
              {isFa ? 'سیاست پیش‌فرض:' : 'Default policy:'}
            </span>
            <SegmentedControl<SplitTunnelingRuleMode>
              ariaLabel={isFa ? 'حالت قانون برنامه‌ها' : 'Application split tunneling rule mode'}
              value={ruleMode}
              onChange={(next) => {
                if (!splitTunnelingActive) onActivateSplitTunneling();
                onRuleModeChange(next);
              }}
              options={[
                {
                  value: 'exclude_selected',
                  label: isFa ? 'عبور همه (به‌جز خاموش‌ها)' : 'Bypass Listed',
                },
                {
                  value: 'include_selected',
                  label: isFa ? 'فقط روشن‌ها از VPN' : 'VPN Listed Only',
                },
              ]}
            />
          </div>

          <SegmentedControl<AppListFilterMode>
            ariaLabel={isFa ? 'فیلتر وضعیت برنامه‌ها' : 'Filter applications by VPN state'}
            value={filterMode}
            onChange={setFilterMode}
            options={[
              { value: 'all', label: isFa ? 'همه' : 'All' },
              { value: 'vpn', label: isFa ? 'از VPN' : 'VPN' },
              { value: 'bypassed', label: isFa ? 'مستقیم' : 'Direct' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative min-w-[210px] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-[var(--asis-text-secondary)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isFa
                  ? 'جستجو بر اساس نام یا شناسه برنامه...'
                  : 'Search installed apps or package ID...'
              }
              aria-label={isFa ? 'جستجوی برنامه‌ها' : 'Search installed applications'}
              className="h-9 w-full rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface-2)]/60 ps-9 pe-8 text-xs text-[var(--asis-text-primary)] placeholder-[var(--asis-text-secondary)]/70 transition-colors focus:border-[var(--asis-primary)] focus:bg-[var(--asis-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--asis-primary)]/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={isFa ? 'پاک کردن جستجو' : 'Clear search'}
                className="absolute top-1/2 end-2.5 -translate-y-1/2 text-[var(--asis-text-secondary)] hover:text-[var(--asis-text-primary)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <select
            aria-label={isFa ? 'فیلتر دسته‌بندی برنامه‌ها' : 'Filter by application category'}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as InstalledAppCategory | 'all')}
            className="h-9 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface-2)]/60 px-3 text-xs text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--asis-primary)]/20"
          >
            <option value="all">{isFa ? 'همه دسته‌ها' : 'All Categories'}</option>
            {(Object.keys(CATEGORY_LABELS) as InstalledAppCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {isFa ? CATEGORY_LABELS[cat].fa : CATEGORY_LABELS[cat].en}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2">
            {hasSystemApps && (
              <div className="flex items-center gap-2 px-1">
                <ToggleSwitch
                  size="sm"
                  checked={showSystemApps}
                  onChange={setShowSystemApps}
                  ariaLabel={isFa ? 'نمایش برنامه‌های سیستمی' : 'Show system apps'}
                />
                <span className="text-xs text-[var(--asis-text-secondary)] whitespace-nowrap">
                  {isFa ? 'برنامه‌های سیستمی' : 'System apps'}
                </span>
              </div>
            )}

            {filteredApps.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleBulkToggle(true)}>
                  {isFa ? 'VPN برای همه' : 'Enable All'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleBulkToggle(false)}>
                  {isFa ? 'دور زدن همه' : 'Bypass All'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Applications Rows (hairline dividers inside parent card) */}
      {loadingApps ? (
        <SkeletonList rows={4} />
      ) : filteredApps.length > 0 ? (
        <div
          role="list"
          aria-label={isFa ? 'لیست برنامه‌های انتخابی تونل‌سازی' : 'Split tunneling applications'}
          className="divide-y divide-[var(--asis-border)] border-t border-[var(--asis-border)]"
        >
          {filteredApps.map((app) => {
            const Icon = CATEGORY_ICONS[app.category] ?? AppWindow;
            const vpnEnabled = isAppRoutedThroughVpn(app.id, ruleMode, selectedAppIds);
            const categoryText = isFa
              ? CATEGORY_LABELS[app.category].fa
              : CATEGORY_LABELS[app.category].en;

            return (
              <div
                key={app.id}
                role="listitem"
                className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-[var(--asis-surface-2)]/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--asis-text-primary)]">
                      {app.name}
                    </p>
                    <p className="truncate font-mono text-xs text-[var(--asis-text-secondary)]">
                      {app.identifier} · {categoryText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-mono text-xs font-medium whitespace-nowrap ${
                      vpnEnabled
                        ? 'text-[var(--asis-accent-fg)]'
                        : 'text-[var(--asis-text-secondary)]'
                    }`}
                  >
                    {vpnEnabled ? (isFa ? 'از VPN' : 'VPN') : isFa ? 'مستقیم' : 'Direct'}
                  </span>

                  <ToggleSwitch
                    checked={vpnEnabled}
                    onChange={(next) => handleToggleApp(app.id, next)}
                    ariaLabel={
                      isFa
                        ? `دسترسی VPN برای ${app.name}`
                        : `Toggle VPN access for ${app.name}`
                    }
                  />

                  {app.source === 'custom_entry' && (
                    <button
                      type="button"
                      onClick={() => onRemoveCustomApp(app.id)}
                      aria-label={
                        isFa ? `حذف قانون ${app.name}` : `Remove rule for ${app.name}`
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:bg-[#3A0C12]/50 dark:hover:text-[#F87171] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={
            applications.length === 0
              ? isFa
                ? 'برنامه‌ای در فهرست انتخاب ثبت نشده است'
                : 'No application rules configured yet'
              : isFa
                ? 'برنامه‌ای با این فیلتر پیدا نشد'
                : 'No matching applications found'
          }
          description={
            applications.length === 0
              ? isWeb
                ? isFa
                  ? 'شناسایی خودکار برنامه‌های نصب‌شده در نسخه بومی اندروید و ویندوز فعال است. در این پیش‌نمایش می‌توانید شناسه برنامه (مانند com.whatsapp یا chrome.exe) را به‌صورت دستی اضافه کرده و دسترسی VPN آن را تغییر دهید.'
                  : 'Automatic OS app scanning activates on native Android and Windows builds. You can add package IDs or executable names (e.g. com.whatsapp or chrome.exe) manually to configure and toggle rules now.'
                : isFa
                  ? 'برنامه‌های نصب‌شده دستگاه بارگذاری نشدند؛ می‌توانید اسکن مجدد انجام دهید یا شناسه برنامه را دستی اضافه کنید.'
                  : 'No installed applications were returned by the OS bridge. Rescan apps or add an application rule manually.'
              : isFa
                ? 'عبارت جستجو یا فیلتر دسته‌بندی را تغییر دهید.'
                : 'Adjust your search term, category, or VPN routing filter to view matching apps.'
          }
          actionLabel={
            applications.length === 0
              ? isFa
                ? 'افزودن شناسه برنامه'
                : 'Add App Rule'
              : isFa
                ? 'پاک کردن فیلترها'
                : 'Reset Filters'
          }
          onAction={() => {
            if (applications.length === 0) {
              setFormError(null);
              setAddOpen(true);
            } else {
              setQuery('');
              setFilterMode('all');
              setCategoryFilter('all');
            }
          }}
        />
      )}

      {/* Add Custom Application Rule Dialog */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={isFa ? 'افزودن قانون برنامه برای Split Tunneling' : 'Add Split Tunneling Application Rule'}
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <p className="text-xs text-[var(--asis-text-secondary)]">
            {isFa
              ? 'نام نمایشی و شناسه بسته (اندروید) یا نام فایل اجرایی (ویندوز) را وارد کنید یا از الگوهای آماده استفاده نمایید.'
              : 'Enter an application name and Android package ID / Windows executable, or pick a quick template below.'}
          </p>

          {/* 1-Click Package Identifier Templates */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-[var(--asis-text-secondary)]">
              {isFa ? 'الگوهای سریع:' : 'Quick identifiers:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {IDENTIFIER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.identifier}
                  type="button"
                  onClick={() => {
                    setCustomName(tpl.name);
                    setCustomIdentifier(tpl.identifier);
                    setCustomCategory(tpl.category);
                    setFormError(null);
                  }}
                  className="rounded-lg border border-[var(--asis-border)] bg-[var(--asis-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--asis-text-primary)] transition-colors hover:border-[var(--asis-primary-border)] hover:text-[var(--asis-accent-fg)] cursor-pointer whitespace-nowrap"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {formError && <StatusBanner tone="error" title={formError} />}

          <Input
            label={isFa ? 'نام برنامه' : 'Application Name'}
            placeholder={isFa ? 'مثلاً WhatsApp یا Chrome' : 'e.g. WhatsApp or Google Chrome'}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />

          <Input
            label={isFa ? 'شناسه بسته یا فایل اجرایی' : 'Package ID or Executable'}
            placeholder="com.whatsapp or chrome.exe"
            value={customIdentifier}
            onChange={(e) => setCustomIdentifier(e.target.value)}
            className="font-mono text-xs"
            hint={
              isFa
                ? 'برای اندروید شناسه بسته (com.example.app) و برای ویندوز نام فایل (app.exe) وارد کنید.'
                : 'Use reverse-DNS package name on Android or .exe process name on Windows.'
            }
          />

          <div className="space-y-1.5">
            <label
              htmlFor="asis-app-category"
              className="block text-sm font-medium text-[var(--asis-text-primary)]"
            >
              {isFa ? 'دسته‌بندی' : 'Category'}
            </label>
            <select
              id="asis-app-category"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value as InstalledAppCategory)}
              className="h-11 w-full rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3.5 text-sm text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--asis-primary)]/20"
            >
              {(Object.keys(CATEGORY_LABELS) as InstalledAppCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {isFa ? CATEGORY_LABELS[cat].fa : CATEGORY_LABELS[cat].en}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {isFa ? 'انصراف' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary">
              {isFa ? 'افزودن به قوانین' : 'Add Application'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
