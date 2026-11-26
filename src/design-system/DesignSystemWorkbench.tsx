import React, { useState } from 'react';
import { Globe, Layers, Moon, Shield, Sun } from 'lucide-react';
import { usePreferences } from './ThemeContext';
import { translations } from './i18n';
import { ASIS_BRAND_TOKENS, type LocaleCode, type ThemeMode } from './tokens';
import {
  BrandLogo,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  SegmentedControl,
  SkeletonList,
  StatusBanner,
} from './components';
import { AuthForm, type AuthSession } from '../features/auth';
import { GatewayStatusView } from '../features/gateway/GatewayStatusView';
import { SubscriptionsView, type SubscriptionRecord } from '../features/subscriptions';
import { ServersView, type ServerCatalogEntry } from '../features/servers';

type PreviewStateMode = 'populated' | 'loading' | 'empty' | 'error';
type WorkspaceView = 'auth' | 'subscriptions' | 'servers' | 'gateway' | 'design-system';

const SWATCHES = [
  { name: 'Primary', hex: ASIS_BRAND_TOKENS.colors.primary, role: 'Action CTA & Active Ring' },
  { name: 'Secondary', hex: ASIS_BRAND_TOKENS.colors.secondary, role: 'Soft Blue Tint (Light)' },
  { name: 'Background', hex: ASIS_BRAND_TOKENS.colors.background, role: 'Light Canvas' },
  { name: 'Primary Text', hex: ASIS_BRAND_TOKENS.colors.primaryText, role: 'High-Contrast Ink' },
  { name: 'Secondary Text', hex: ASIS_BRAND_TOKENS.colors.secondaryText, role: 'Muted Metadata' },
  { name: 'Accent', hex: ASIS_BRAND_TOKENS.colors.accent, role: 'Hover & Dark Primary' },
];

const ROADMAP_PHASES = [
  { id: '00', en: 'Phase 0 · Architecture & Spec Analysis', fa: 'فاز ۰ · تحلیل مشخصات و معماری', done: true },
  { id: '01', en: 'Phase 1 · Project Structure & Design System', fa: 'فاز ۱ · ساختار پروژه و سیستم طراحی', done: true },
  { id: '02', en: 'Phase 2 · Auth & Local Session Handling', fa: 'فاز ۲ · احراز هویت و نشست محلی', done: false },
  { id: '03', en: 'Phase 3 · Backend API & Integration Adapters', fa: 'فاز ۳ · درگاه API و آداپتورهای اتصال', done: false },
  { id: '04', en: 'Phase 4 · Subscriptions & Manual Import', fa: 'فاز ۴ · اشتراک‌ها و افزودن دستی', done: false },
  { id: '05', en: 'Phase 5 · Server Catalog & Smart Selection', fa: 'فاز ۵ · فهرست سرورها و انتخاب هوشمند', done: false },
  { id: '06', en: 'Phase 6 · VPN Engine Abstraction & Parsers', fa: 'فاز ۶ · انتزاع موتور VPN و پارسرها', done: false },
  { id: '07', en: 'Phase 7 · Native Android, iOS & Windows Modules', fa: 'فاز ۷ · ماژول‌های بومی اندروید، iOS و ویندوز', done: false },
  { id: '08', en: 'Phase 8 · Connection Monitoring & Statistics', fa: 'فاز ۸ · پایش اتصال و آمار مصرف', done: false },
  { id: '09', en: 'Phase 9 · Advanced Settings, Updates & Support', fa: 'فاز ۹ · تنظیمات پیشرفته، بروزرسانی و پشتیبانی', done: false },
  { id: '10', en: 'Phase 10 · Security Audit, QA & Release', fa: 'فاز ۱۰ · بازبینی امنیتی، تست و انتشار', done: false },
];

function validateHttpsSubscriptionUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export function DesignSystemWorkbench() {
  const { theme, setTheme, locale, setLocale } = usePreferences();
  const t = translations[locale];

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('servers');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerCatalogEntry | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [subUrl, setSubUrl] = useState('https://example.com/sub/token');
  const [stateMode, setStateMode] = useState<PreviewStateMode>('populated');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogVerified, setDialogVerified] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const isUrlValid = validateHttpsSubscriptionUrl(subUrl);

  const handleLoadingClick = () => {
    setLoadingDemo(true);
    window.setTimeout(() => setLoadingDemo(false), 900);
  };

  return (
    <div className="min-h-screen bg-white text-[#0E1428] dark:bg-[#0B1120] dark:text-[#F1F5F9] transition-colors duration-150">
      {/* Top Bar: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-xs dark:border-[#1E293B] dark:bg-[#0B1120]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#overview"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#0E1428] dark:text-[#F1F5F9] whitespace-nowrap shrink-0"
          >
            <BrandLogo className="w-7 h-7 shrink-0" />
            <span>{t.brandName}</span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#64748B] dark:text-[#94A3B8]"
          >
            <button
              type="button"
              onClick={() => setWorkspaceView('auth')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceView === 'auth'
                  ? 'text-[#087BFF] dark:text-[#60A5FA] font-semibold'
                  : 'hover:text-[#087BFF] dark:hover:text-[#3898FF]'
              }`}
            >
              {locale === 'fa-IR' ? 'احراز هویت' : 'Authentication'}
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('subscriptions')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceView === 'subscriptions'
                  ? 'text-[#087BFF] dark:text-[#60A5FA] font-semibold'
                  : 'hover:text-[#087BFF] dark:hover:text-[#3898FF]'
              }`}
            >
              {locale === 'fa-IR' ? 'اشتراک‌ها' : 'Subscriptions'}
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('servers')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceView === 'servers'
                  ? 'text-[#087BFF] dark:text-[#60A5FA] font-semibold'
                  : 'hover:text-[#087BFF] dark:hover:text-[#3898FF]'
              }`}
            >
              {locale === 'fa-IR' ? 'سرورها' : 'Locations'}
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('gateway')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceView === 'gateway'
                  ? 'text-[#087BFF] dark:text-[#60A5FA] font-semibold'
                  : 'hover:text-[#087BFF] dark:hover:text-[#3898FF]'
              }`}
            >
              {locale === 'fa-IR' ? 'درگاه API' : 'API Gateway'}
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('design-system')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspaceView === 'design-system'
                  ? 'text-[#087BFF] dark:text-[#60A5FA] font-semibold'
                  : 'hover:text-[#087BFF] dark:hover:text-[#3898FF]'
              }`}
            >
              {t.navComponents}
            </button>
          </nav>

          <div className="shrink-0">
            <Button
              size="sm"
              onClick={() =>
                workspaceView === 'design-system' ? setDialogOpen(true) : setWorkspaceView('design-system')
              }
            >
              {workspaceView === 'design-system' ? t.primaryCta : t.navComponents}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-14">
        {/* Hero + Workspace Preferences Toolbar */}
        <section id="overview" className="space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-[#E2E8F0] pb-8 dark:border-[#1E293B]">
            <div className="max-w-2xl space-y-3 text-start">
              <p className="text-xs font-medium text-[#087BFF] dark:text-[#60A5FA]">
                {t.heroMeta}
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                {t.heroTitle}
              </h1>
              <p className="text-base leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {t.heroSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <SegmentedControl<WorkspaceView>
                ariaLabel="Workspace view"
                value={workspaceView}
                onChange={setWorkspaceView}
                wrap
                options={[
                  { value: 'auth', label: locale === 'fa-IR' ? 'ورود (فاز ۲)' : 'Auth' },
                  { value: 'gateway', label: locale === 'fa-IR' ? 'درگاه (فاز ۳)' : 'Gateway' },
                  { value: 'subscriptions', label: locale === 'fa-IR' ? 'اشتراک (فاز ۴)' : 'Subscriptions' },
                  { value: 'servers', label: locale === 'fa-IR' ? 'سرورها (فاز ۵)' : 'Locations' },
                  { value: 'design-system', label: t.navComponents },
                ]}
              />

              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
                <SegmentedControl<LocaleCode>
                  ariaLabel={t.languageLabel}
                  value={locale}
                  onChange={setLocale}
                  options={[
                    { value: 'en-US', label: 'English (LTR)' },
                    { value: 'fa-IR', label: 'فارسی (RTL)' },
                  ]}
                />
              </div>

              <div className="flex items-center gap-2">
                {theme === 'light' ? (
                  <Sun className="w-4 h-4 text-[#64748B]" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4 text-[#94A3B8]" aria-hidden="true" />
                )}
                <SegmentedControl<ThemeMode>
                  ariaLabel={t.themeLabel}
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: 'light', label: t.themeLight },
                    { value: 'dark', label: t.themeDark },
                  ]}
                />
              </div>
            </div>
          </div>

          {dialogVerified && (
            <StatusBanner
              tone="success"
              title={t.dialogConfirmedNote}
              description={t.dialogBody}
            />
          )}
        </section>

        {workspaceView === 'auth' ? (
          <section aria-label="Authentication">
            <AuthForm onAuthenticated={setAuthSession} />
          </section>
        ) : workspaceView === 'subscriptions' ? (
          <section aria-label="Subscriptions">
            <SubscriptionsView
              session={authSession}
              subscriptions={subscriptions}
              onSubscriptionsChange={setSubscriptions}
              activeSubscriptionId={activeSubscriptionId}
              onSelectSubscription={(sub) => setActiveSubscriptionId(sub.id)}
            />
          </section>
        ) : workspaceView === 'servers' ? (
          <section aria-label="Server Locations">
            <ServersView
              session={authSession}
              subscriptions={subscriptions}
              selectedServerId={selectedServer?.id ?? null}
              onSelectServer={setSelectedServer}
              onNavigateToSubscriptions={() => setWorkspaceView('subscriptions')}
            />
          </section>
        ) : workspaceView === 'gateway' ? (
          <section aria-label="Client API Gateway">
            <GatewayStatusView />
          </section>
        ) : (
          <>
            {/* Section 1: Brand Palette & Typography */}
            <section className="space-y-6">
              <div className="space-y-1 text-start">
                <h2 className="text-xl font-semibold tracking-tight">{t.sectionFoundationTitle}</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              {t.sectionFoundationDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7 space-y-4">
              <h3 className="text-sm font-semibold text-start">{t.paletteTitle}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {SWATCHES.map((swatch) => (
                  <div
                    key={swatch.name}
                    className="rounded-lg border border-[#E2E8F0] p-3 text-start dark:border-[#1E293B]"
                  >
                    <div
                      className="h-10 w-full rounded-md border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <p className="mt-2.5 text-sm font-semibold">{swatch.name}</p>
                    <p className="font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {swatch.hex}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {swatch.role}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-5 flex flex-col justify-between space-y-5 text-start">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t.typographyTitle}</h3>
                <div className="space-y-2 border-b border-[#E2E8F0] pb-4 dark:border-[#1E293B]">
                  <p className="text-2xl font-bold tracking-tight">ASiS VPN · شبکه‌ی امن</p>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Plus Jakarta Sans (LTR) · Vazirmatn (RTL) · JetBrains Mono
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[#EAF3FF] p-3.5 dark:bg-[#132238]">
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {t.sampleMetricLatency}
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#0E1428] dark:text-[#F1F5F9]">
                    -- ms
                  </p>
                </div>
                <div className="rounded-lg bg-[#EAF3FF] p-3.5 dark:bg-[#132238]">
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {t.sampleMetricUsage}
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#0E1428] dark:text-[#F1F5F9]">
                    0.00 / 0.00 GB
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Section 2: Reusable UI Primitives */}
        <section id="components" className="space-y-6">
          <div className="space-y-1 text-start">
            <h2 className="text-xl font-semibold tracking-tight">{t.sectionComponentsTitle}</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              {t.sectionComponentsDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="space-y-5 text-start">
              <h3 className="text-sm font-semibold">{t.buttonsTitle}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => setDialogOpen(true)}>
                  {t.btnPrimary}
                </Button>
                <Button variant="secondary" onClick={handleLoadingClick}>
                  {t.btnSecondary}
                </Button>
                <Button variant="outline" onClick={() => setStateMode('empty')}>
                  {t.btnOutline}
                </Button>
                <Button variant="danger" onClick={() => setStateMode('error')}>
                  {t.btnDanger}
                </Button>
                <Button variant="primary" loading={loadingDemo} onClick={handleLoadingClick}>
                  {t.btnLoading}
                </Button>
              </div>

              <div className="border-t border-[#E2E8F0] pt-5 space-y-4 dark:border-[#1E293B]">
                <h3 className="text-sm font-semibold">{t.inputsTitle}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label={t.inputUsernameLabel}
                    placeholder={t.inputUsernamePlaceholder}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <Input
                    label={t.inputPasswordLabel}
                    type="password"
                    allowPasswordToggle
                    placeholder={t.inputPasswordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Input
                  label={t.inputUrlLabel}
                  placeholder={t.inputUrlPlaceholder}
                  value={subUrl}
                  onChange={(e) => setSubUrl(e.target.value)}
                  error={!isUrlValid ? t.inputInvalidMsg : undefined}
                  hint={isUrlValid && subUrl.trim() ? t.inputValidMsg : undefined}
                />
              </div>
            </Card>

            <Card className="space-y-5 text-start">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t.statesTitle}</h3>
                <SegmentedControl<PreviewStateMode>
                  ariaLabel={t.statesTitle}
                  value={stateMode}
                  onChange={setStateMode}
                  options={[
                    { value: 'populated', label: t.statePopulated },
                    { value: 'loading', label: t.stateLoading },
                    { value: 'empty', label: t.stateEmpty },
                    { value: 'error', label: t.stateError },
                  ]}
                />
              </div>

              {stateMode === 'populated' && (
                <div className="space-y-3">
                  <StatusBanner
                    tone="info"
                    title={t.populatedTitle}
                    description={t.populatedMeta}
                  />
                  <div className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] dark:divide-[#1E293B] dark:border-[#1E293B]">
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium">PasarGuard Adapter</span>
                      <span className="font-mono text-xs text-[#D97706] dark:text-[#FBBF24]">
                        {t.statusNotConnected}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium">Reseller Adapter</span>
                      <span className="font-mono text-xs text-[#D97706] dark:text-[#FBBF24]">
                        {t.statusNotConnected}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium">Design Tokens & RTL</span>
                      <span className="font-mono text-xs text-[#16A34A] dark:text-[#4ADE80]">
                        {t.statusCompleted}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {stateMode === 'loading' && <SkeletonList rows={3} />}

              {stateMode === 'empty' && (
                <EmptyState
                  title={t.emptyHeading}
                  description={t.emptyBody}
                  actionLabel={t.emptyAction}
                  onAction={() => setStateMode('populated')}
                />
              )}

              {stateMode === 'error' && (
                <ErrorState
                  title={t.errorHeading}
                  description={t.errorBody}
                  actionLabel={t.errorAction}
                  onAction={() => setStateMode('populated')}
                />
              )}
            </Card>
          </div>
        </section>

        {/* Section 3: Runtime & Integration Boundaries */}
        <section id="architecture" className="space-y-6">
          <div className="space-y-1 text-start">
            <h2 className="text-xl font-semibold tracking-tight">{t.sectionArchitectureTitle}</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              {t.sectionArchitectureDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 text-start">
            <Card className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#087BFF] dark:text-[#60A5FA]">
                <Layers className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1428] dark:text-[#F1F5F9]">
                  {t.platformWebTitle}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {t.platformWebBody}
              </p>
            </Card>

            <Card className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#087BFF] dark:text-[#60A5FA]">
                <Shield className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1428] dark:text-[#F1F5F9]">
                  {t.platformNativeTitle}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {t.platformNativeBody}
              </p>
            </Card>

            <Card className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#D97706] dark:text-[#FBBF24]">
                <Globe className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1428] dark:text-[#F1F5F9]">
                  {t.integrationTitle}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {t.integrationBody}
              </p>
            </Card>
          </div>
        </section>

        {/* Section 4: Phased Engineering Roadmap */}
        <section id="roadmap" className="space-y-6">
          <div className="space-y-1 text-start">
            <h2 className="text-xl font-semibold tracking-tight">{t.sectionRoadmapTitle}</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              {t.sectionRoadmapDesc}
            </p>
          </div>

          <Card padding="none" className="overflow-hidden">
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
              {ROADMAP_PHASES.map((phase) => (
                <div
                  key={phase.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 text-sm text-start"
                >
                  <span className="font-medium">
                    {locale === 'fa-IR' ? phase.fa : phase.en}
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      phase.done
                        ? 'text-[#16A34A] dark:text-[#4ADE80]'
                        : 'text-[#64748B] dark:text-[#94A3B8]'
                    }`}
                  >
                    {phase.done ? t.statusCompleted : t.statusPending}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
          </>
        )}
      </main>

      <footer className="border-t border-[#E2E8F0] py-6 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <span>{t.footerCopyright}</span>
          <span>{t.footerMeta}</span>
        </div>
      </footer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t.dialogTitle}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              {t.dialogCancel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDialogVerified(true);
                setDialogOpen(false);
              }}
            >
              {t.dialogConfirm}
            </Button>
          </>
        }
      >
        {t.dialogBody}
      </Dialog>
    </div>
  );
}
