import React, { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Globe,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  Button,
  Card,
  CountryFlag,
  Dialog,
  EmptyState,
  Input,
  LatencyIndicator,
  SegmentedControl,
  ServerCatalogSkeleton,
  StatusBanner,
} from '../../design-system/components';
import type { AuthSession } from '../auth';
import { parseSubscriptionPayload, type SubscriptionRecord } from '../subscriptions';
import {
  buildServerCatalogFromSubscriptions,
  evaluateSmartSelection,
  inferCountryMetadata,
  resolveCountryByCode,
  SUPPORTED_COUNTRY_OPTIONS,
} from './serverCatalogUtils';
import { serverTranslations } from './serverTranslations';
import type {
  CustomServerEntry,
  ProbeResultEntry,
  ServerCatalogEntry,
  SmartSelectionOutcome,
  SmartSelectionPolicy,
} from './types';

interface ServersViewProps {
  session?: AuthSession | null;
  subscriptions: SubscriptionRecord[];
  customServers?: CustomServerEntry[];
  probeResults?: Record<string, ProbeResultEntry>;
  probingIds?: Set<string>;
  onProbeServers?: (servers: ServerCatalogEntry[]) => void;
  onAddCustomServers?: (entries: CustomServerEntry[]) => void;
  onRemoveCustomServer?: (serverId: string) => void;
  selectedServerId: string | null;
  onSelectServer: (server: ServerCatalogEntry) => void;
  onNavigateToSubscriptions: () => void;
}

type SortMode = 'default' | 'latency' | 'name';

const FAVORITES_STORAGE_KEY = 'asis_server_favorites_v1';
const RECENTS_STORAGE_KEY = 'asis_server_recents_v1';

function loadStoredArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function ServersView({
  session = null,
  subscriptions,
  customServers = [],
  probeResults = {},
  probingIds = new Set(),
  onProbeServers,
  onAddCustomServers,
  onRemoveCustomServer,
  selectedServerId,
  onSelectServer,
  onNavigateToSubscriptions,
}: ServersViewProps) {
  const { locale } = usePreferences();
  const isFa = locale === 'fa-IR';
  const t = serverTranslations[locale];

  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pendingServerId, setPendingServerId] = useState<string | null>(selectedServerId);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(loadStoredArray(FAVORITES_STORAGE_KEY)),
  );
  const [recentIds, setRecentIds] = useState<string[]>(() => loadStoredArray(RECENTS_STORAGE_KEY));

  const [smartPolicy, setSmartPolicy] = useState<SmartSelectionPolicy>('automatic');
  const [smartCountryTarget, setSmartCountryTarget] = useState<string>('');
  const [lastOutcome, setLastOutcome] = useState<SmartSelectionOutcome | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [gatewayNotice, setGatewayNotice] = useState<string | null>(null);

  // Add Custom Location modal state
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCountryCode, setCustomCountryCode] = useState('AUTO');
  const [customConfigText, setCustomConfigText] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const allServers = useMemo(
    () => buildServerCatalogFromSubscriptions(subscriptions, customServers, probeResults),
    [subscriptions, customServers, probeResults],
  );

  const availableCountries = useMemo(() => {
    const map = new Map<string, { code: string; label: string }>();
    for (const srv of allServers) {
      if (srv.countryCode && !map.has(srv.countryCode)) {
        const localized = resolveCountryByCode(srv.countryCode);
        const displayCountry = isFa
          ? (localized?.nameFa ?? srv.countryName ?? srv.countryCode)
          : (localized?.nameEn ?? srv.countryName ?? srv.countryCode);
        map.set(srv.countryCode, {
          code: srv.countryCode,
          label: `${srv.countryFlag ?? ''} ${displayCountry}`.trim(),
        });
      }
    }
    return Array.from(map.values());
  }, [allServers, isFa]);

  const availableProtocols = useMemo(
    () => Array.from(new Set(allServers.map((s) => s.protocol))).sort(),
    [allServers],
  );

  const filteredServers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = allServers.filter((srv) => {
      if (favoritesOnly && !favoriteIds.has(srv.id)) return false;
      if (countryFilter !== 'ALL' && srv.countryCode !== countryFilter) return false;
      if (protocolFilter !== 'ALL' && srv.protocol !== protocolFilter) return false;
      if (q) {
        const localized = resolveCountryByCode(srv.countryCode);
        const hay = `${srv.name} ${srv.countryName ?? ''} ${localized?.nameFa ?? ''} ${srv.countryCode ?? ''} ${srv.protocol} ${srv.group}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortMode === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortMode === 'latency') {
      return [...filtered].sort((a, b) => {
        if (a.probeLatencyMs !== null && b.probeLatencyMs !== null) {
          return a.probeLatencyMs - b.probeLatencyMs;
        }
        if (a.probeLatencyMs !== null) return -1;
        if (b.probeLatencyMs !== null) return 1;
        return 0;
      });
    }
    return filtered;
  }, [allServers, countryFilter, favoriteIds, favoritesOnly, protocolFilter, searchQuery, sortMode]);

  const recentServers = useMemo(
    () =>
      recentIds
        .map((id) => allServers.find((s) => s.id === id))
        .filter((s): s is ServerCatalogEntry => Boolean(s)),
    [allServers, recentIds],
  );

  const handleToggleFavorite = (serverId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleSelectServer = (srv: ServerCatalogEntry) => {
    if (!srv.supported) return;
    onSelectServer(srv);
    setRecentIds((prev) => {
      const next = [srv.id, ...prev.filter((id) => id !== srv.id)].slice(0, 5);
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleRunSmartSelect = () => {
    const outcome = evaluateSmartSelection(allServers, smartPolicy, {
      favoriteIds,
      targetCountryCode: smartCountryTarget || availableCountries[0]?.code || null,
      targetServerId: selectedServerId,
    });
    setLastOutcome(outcome);
    if (outcome.selectedServer) {
      handleSelectServer(outcome.selectedServer);
    }
  };

  const handleRefreshCatalog = async () => {
    setRefreshing(true);
    setGatewayNotice(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (session?.tokens.accessToken) {
        headers.Authorization = `Bearer ${session.tokens.accessToken}`;
      }
      const res = await fetch('/api/v1/servers', { headers });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { code?: string; message?: string };
        };
        if (body.error?.message) {
          setGatewayNotice(`${body.error.code ?? 'GATEWAY'}: ${body.error.message}`);
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveCustomLocation = (event: React.FormEvent) => {
    event.preventDefault();
    setCustomError(null);

    const parsed = parseSubscriptionPayload(customConfigText);
    if (parsed.endpoints.length === 0) {
      setCustomError(t.customErrorInvalid);
      return;
    }

    const explicitCountry =
      customCountryCode !== 'AUTO' ? resolveCountryByCode(customCountryCode) : null;
    const now = new Date().toISOString();

    const created: CustomServerEntry[] = parsed.endpoints.map((ep, idx) => {
      const displayName =
        customName.trim() && parsed.endpoints.length === 1
          ? customName.trim()
          : customName.trim()
            ? `${customName.trim()} #${idx + 1}`
            : ep.name;

      const inferred = explicitCountry
        ? {
            countryCode: explicitCountry.code,
            countryFlag: explicitCountry.flag,
            countryName: explicitCountry.nameEn,
          }
        : inferCountryMetadata(`${displayName} ${ep.name}`);

      return {
        id: `custom_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: displayName,
        countryCode: inferred.countryCode,
        countryFlag: inferred.countryFlag,
        countryName: inferred.countryName,
        protocol: ep.protocol,
        supported: ep.supported,
        hostRedacted: ep.hostRedacted,
        probeHost: ep.probeHost,
        port: ep.port,
        createdAt: now,
      };
    });

    onAddCustomServers?.(created);
    const firstSupported = created.find((c) => c.supported);
    if (firstSupported) {
      const catalogItem: ServerCatalogEntry = {
        id: firstSupported.id,
        subscriptionId: 'custom_locations',
        subscriptionName: 'Custom Locations',
        name: firstSupported.name,
        countryCode: firstSupported.countryCode,
        countryFlag: firstSupported.countryFlag,
        countryName: firstSupported.countryName,
        city: null,
        group: 'Custom',
        protocol: firstSupported.protocol,
        supported: firstSupported.supported,
        hostRedacted: firstSupported.hostRedacted,
        probeHost: firstSupported.probeHost,
        port: firstSupported.port,
        available: null,
        probeLatencyMs: null,
        measurementSource: 'unavailable',
        isCustom: true,
      };
      onSelectServer(catalogItem);
      if (onProbeServers) {
        onProbeServers([catalogItem]);
      }
    }

    setCustomName('');
    setCustomCountryCode('AUTO');
    setCustomConfigText('');
    setCustomModalOpen(false);
  };

  return (
    <div className="space-y-8 text-start">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--asis-border)] pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
            <MapPin className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
            <p className="mt-0.5 text-sm text-[var(--asis-text-secondary)]">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onProbeServers && (
            <Button
              variant="secondary"
              size="sm"
              loading={probingIds.size > 0}
              disabled={filteredServers.every((s) => !s.supported || !s.probeHost || !s.port)}
              icon={<Activity className="w-4 h-4" aria-hidden="true" />}
              onClick={() =>
                onProbeServers(
                  filteredServers.filter((s) => s.supported && s.probeHost && s.port),
                )
              }
            >
              {probingIds.size > 0 ? t.probingBtn : t.testPingBtn}
            </Button>
          )}
          {onAddCustomServers && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
              onClick={() => {
                setCustomError(null);
                setCustomModalOpen(true);
              }}
            >
              {t.addCustomBtn}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            loading={refreshing}
            icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
            onClick={() => void handleRefreshCatalog()}
          >
            {t.refreshBtn}
          </Button>
        </div>
      </div>

      <StatusBanner
        tone="info"
        title={t.icmpVsTunnelTitle}
        description={gatewayNotice ?? t.icmpVsTunnelBody}
      />

      {/* Smart Connection Policy */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--asis-accent-fg)]" aria-hidden="true" />
            <h3 className="text-base font-semibold">{t.smartSectionTitle}</h3>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Zap className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={handleRunSmartSelect}
            disabled={allServers.length === 0}
          >
            {t.runSmartSelect}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl<SmartSelectionPolicy>
            ariaLabel={t.smartPolicyLabel}
            value={smartPolicy}
            onChange={setSmartPolicy}
            wrap
            options={[
              { value: 'automatic', label: t.policyAutomatic },
              { value: 'lowest_latency', label: t.policyLowestLatency },
              { value: 'specific_country', label: t.policySpecificCountry },
              { value: 'favorite_server', label: t.policyFavoriteServer },
              { value: 'specific_server', label: t.policySpecificServer },
            ]}
          />

          {smartPolicy === 'specific_country' && availableCountries.length > 0 && (
            <select
              aria-label={t.policySpecificCountry}
              value={smartCountryTarget || availableCountries[0]?.code || ''}
              onChange={(e) => setSmartCountryTarget(e.target.value)}
              className="min-h-[38px] rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3 text-xs text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none"
            >
              {availableCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {lastOutcome && (
          <StatusBanner
            tone={lastOutcome.selectedServer ? 'success' : 'warning'}
            title={t.smartDiagnosticTitle}
            description={`${t.reasonMessages[lastOutcome.reasonCode]} (${lastOutcome.compatibleCount}/${lastOutcome.evaluatedCount} compatible · ${lastOutcome.excludedUnsupportedCount} unsupported)`}
          />
        )}
      </Card>

      {/* Recent Servers */}
      {recentServers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t.recentServersTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {recentServers.map((srv) => (
              <Button
                key={srv.id}
                variant={selectedServerId === srv.id ? 'primary' : 'outline'}
                size="sm"
                icon={<CountryFlag code={srv.countryCode} emoji={srv.countryFlag} className="w-4 h-3" />}
                onClick={() => handleSelectServer(srv)}
              >
                {srv.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Catalog Controls & Table */}
      {refreshing ? (
        <ServerCatalogSkeleton rows={5} />
      ) : allServers.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyBody}
          actionLabel={onAddCustomServers ? t.addCustomBtn : t.emptyAction}
          onAction={
            onAddCustomServers
              ? () => {
                  setCustomError(null);
                  setCustomModalOpen(true);
                }
              : onNavigateToSubscriptions
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="md:hidden">
            <SegmentedControl<'all' | 'favorites'>
              ariaLabel={isFa ? 'فیلتر سرورها' : 'Server filter'}
              value={favoritesOnly ? 'favorites' : 'all'}
              onChange={(v) => setFavoritesOnly(v === 'favorites')}
              options={[
                { value: 'all', label: isFa ? 'همه کشورها' : 'All countries' },
                { value: 'favorites', label: isFa ? 'علاقه‌مندی‌ها' : 'Favorites' },
              ]}
            />
          </div>

          <Card className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
            <div className="md:col-span-4">
              <Input
                label={t.colServer}
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t.colCountry}</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="min-h-[42px] rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3 text-sm text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none"
              >
                <option value="ALL">{t.filterAllCountries}</option>
                {availableCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t.colProtocol}</label>
              <select
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value)}
                className="min-h-[42px] rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3 text-sm text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none"
              >
                <option value="ALL">{t.filterAllProtocols}</option>
                {availableProtocols.map((proto) => (
                  <option key={proto} value={proto}>
                    {proto}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex flex-wrap items-center gap-2">
              <select
                aria-label={t.sortLabel}
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="min-h-[42px] flex-1 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3 text-xs text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none"
              >
                <option value="default">{t.sortDefault}</option>
                <option value="latency">{t.sortLatency}</option>
                <option value="name">{t.sortName}</option>
              </select>
              <Button
                variant={favoritesOnly ? 'secondary' : 'outline'}
                size="md"
                onClick={() => setFavoritesOnly((prev) => !prev)}
                icon={<Star className="w-4 h-4" aria-hidden="true" />}
              >
                {t.filterFavoritesOnly}
              </Button>
            </div>
          </Card>

          {filteredServers.length === 0 ? (
            <EmptyState
              title={t.emptyTitle}
              description={t.reasonMessages.NO_MATCHING_COUNTRY}
              actionLabel={t.refreshBtn}
              onAction={() => {
                setSearchQuery('');
                setCountryFilter('ALL');
                setProtocolFilter('ALL');
                setFavoritesOnly(false);
              }}
            />
          ) : (
            <>
            {/* Mobile: tappable server cards (matches the phone design) */}
            <ul className="space-y-2.5 md:hidden" aria-label={t.title}>
              {filteredServers.map((srv) => {
                const isFavorite = favoriteIds.has(srv.id);
                const isPending = pendingServerId === srv.id;
                const localizedCountry = resolveCountryByCode(srv.countryCode);
                const countryDisplay = isFa
                  ? (localizedCountry?.nameFa ?? srv.countryName)
                  : (localizedCountry?.nameEn ?? srv.countryName);
                return (
                  <li key={srv.id}>
                    <div
                      className={`asis-glass flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-150 ${
                        isPending
                          ? 'border-[var(--asis-primary)] shadow-[0_0_20px_-4px_rgba(var(--asis-glow-rgb),0.7)]'
                          : 'border-[var(--asis-border)]'
                      } ${srv.supported ? '' : 'opacity-60'}`}
                    >
                      <button
                        type="button"
                        disabled={!srv.supported}
                        aria-pressed={isPending}
                        onClick={() => setPendingServerId(srv.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-start cursor-pointer disabled:cursor-not-allowed"
                      >
                        <CountryFlag code={srv.countryCode} emoji={srv.countryFlag} className="w-9 h-9 shrink-0 rounded-full" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {srv.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--asis-text-secondary)]">
                            <span className="truncate">{countryDisplay ?? srv.protocol}</span>
                            <LatencyIndicator
                              latencyMs={srv.probeLatencyMs}
                              available={srv.available}
                              probing={probingIds.has(srv.id)}
                              isFa={isFa}
                            />
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={isFa ? 'علاقه‌مندی' : 'Toggle favorite'}
                        aria-pressed={isFavorite}
                        onClick={() => handleToggleFavorite(srv.id)}
                        className={`shrink-0 p-1.5 cursor-pointer transition-transform duration-150 active:scale-90 ${
                          isFavorite ? 'text-[#FBBF24]' : 'text-[var(--asis-border-strong)]'
                        }`}
                      >
                        <Star className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Sticky connect action above the bottom tab bar */}
            <div className="sticky bottom-24 z-20 md:hidden">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!pendingServerId || !filteredServers.some((s) => s.id === pendingServerId && s.supported)}
                onClick={() => {
                  const target = allServers.find((s) => s.id === pendingServerId);
                  if (target) handleSelectServer(target);
                }}
              >
                {isFa ? 'اتصال به سرور' : 'Connect to server'}
              </Button>
            </div>

            <Card padding="none" className="hidden md:block overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--asis-border)] text-xs text-[var(--asis-text-secondary)]">
                    <th className="px-4 py-3 text-start font-medium">{t.colServer}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCountry}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colProtocol}</th>
                    <th className="px-4 py-3 text-end font-medium">{t.colLatency}</th>
                    <th className="px-4 py-3 text-end font-medium">{t.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--asis-border)]">
                  {filteredServers.map((srv) => {
                    const isFavorite = favoriteIds.has(srv.id);
                    const isSelected = selectedServerId === srv.id;
                    const localizedCountry = resolveCountryByCode(srv.countryCode);
                    const countryDisplay = isFa
                      ? (localizedCountry?.nameFa ?? srv.countryName)
                      : (localizedCountry?.nameEn ?? srv.countryName);

                    return (
                      <tr
                        key={srv.id}
                        className="group transition-colors duration-150 hover:bg-[var(--asis-surface-2)]/70"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              aria-label="Toggle favorite"
                              onClick={() => handleToggleFavorite(srv.id)}
                              className={`cursor-pointer transition-transform duration-150 hover:scale-115 active:scale-90 ${
                                isFavorite
                                  ? 'text-[#D97706] dark:text-[#FBBF24]'
                                  : 'text-[var(--asis-border-strong)] hover:text-[var(--asis-text-secondary)]'
                              }`}
                            >
                              <Star
                                className="w-4 h-4"
                                fill={isFavorite ? 'currentColor' : 'none'}
                              />
                            </button>
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[240px]">
                                {srv.name}
                                {srv.route === 'tunnel' && (
                                  <span className="ms-2 rounded-md border border-[var(--asis-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--asis-accent-fg)]">
                                    {srv.entryCountryCode ?? 'IR'} → {srv.countryCode ?? '?'}
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-xs text-[var(--asis-text-secondary)]">
                                {srv.isCustom ? t.customGroupLabel : srv.group} · {srv.hostRedacted}
                                {srv.port ? `:${srv.port}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs">
                          {srv.countryCode || srv.countryName ? (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <CountryFlag code={srv.countryCode} emoji={srv.countryFlag} />
                              <span>{countryDisplay ?? srv.countryCode}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[var(--asis-text-secondary)]">
                              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{t.unavailableLabel}</span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs">
                          <span
                            className={`inline-flex items-center gap-1.5 ${
                              srv.supported
                                ? 'text-[var(--asis-text-primary)]'
                                : 'text-[#DC2626] dark:text-[#F87171]'
                            }`}
                          >
                            {srv.supported ? (
                              <Lock className="w-3 h-3 text-[var(--asis-accent-fg)]" aria-hidden="true" />
                            ) : (
                              <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                            )}
                            <span>
                              {srv.protocol}
                              {!srv.supported ? ` · ${t.unsupportedLabel}` : ''}
                            </span>
                          </span>
                        </td>

                        <td className="px-4 py-3 text-end">
                          <div className="inline-flex items-center justify-end gap-2">
                            <LatencyIndicator
                              latencyMs={srv.probeLatencyMs}
                              available={srv.available}
                              probing={probingIds.has(srv.id)}
                              isFa={isFa}
                            />
                            {onProbeServers && srv.supported && srv.probeHost && srv.port && (
                              <button
                                type="button"
                                disabled={probingIds.has(srv.id)}
                                onClick={() => onProbeServers([srv])}
                                aria-label={t.pingSingleLabel}
                                title={t.pingSingleLabel}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--asis-text-secondary)] transition-all duration-150 hover:scale-110 hover:bg-[var(--asis-primary-soft)] hover:text-[var(--asis-accent-fg)] disabled:opacity-40 cursor-pointer"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${probingIds.has(srv.id) ? 'animate-spin' : ''}`}
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-end">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {srv.isCustom && onRemoveCustomServer && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t.removeCustomLabel}
                                onClick={() => onRemoveCustomServer(srv.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-[#DC2626] dark:text-[#F87171]" />
                              </Button>
                            )}
                            <Button
                              variant={isSelected ? 'secondary' : 'outline'}
                              size="sm"
                              disabled={!srv.supported}
                              icon={isSelected ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : undefined}
                              onClick={() => handleSelectServer(srv)}
                            >
                              {isSelected ? t.selectedBtn : t.selectBtn}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            </>
          )}
        </div>
      )}

      {/* Add Custom Location Modal */}
      <Dialog
        open={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title={t.customModalTitle}
      >
        <form onSubmit={handleSaveCustomLocation} className="space-y-4">
          <p className="text-xs leading-relaxed text-[var(--asis-text-secondary)]">
            {t.customModalDesc}
          </p>

          {customError && <StatusBanner tone="error" title={customError} />}

          <Input
            label={t.customNameLabel}
            placeholder={t.customNamePlaceholder}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />

          <div className="flex flex-col gap-1.5 text-start">
            <label className="text-sm font-medium text-[var(--asis-text-primary)]">
              {t.customCountryLabel}
            </label>
            <div className="flex items-center gap-2.5">
              {customCountryCode !== 'AUTO' && (
                <CountryFlag code={customCountryCode} className="w-7 h-5" />
              )}
              <select
                aria-label={t.customCountryLabel}
                value={customCountryCode}
                onChange={(e) => setCustomCountryCode(e.target.value)}
                className="min-h-[42px] flex-1 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3 text-sm text-[var(--asis-text-primary)] focus:border-[var(--asis-primary)] focus:outline-none"
              >
                <option value="AUTO">{t.customCountryAuto}</option>
                {SUPPORTED_COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {isFa ? `${c.nameFa} (${c.code})` : `${c.nameEn} (${c.code})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-start">
            <label className="text-sm font-medium text-[var(--asis-text-primary)]">
              {t.customConfigLabel}
            </label>
            <textarea
              rows={4}
              value={customConfigText}
              onChange={(e) => {
                setCustomConfigText(e.target.value);
                if (customError) setCustomError(null);
              }}
              placeholder={t.customConfigPlaceholder}
              className="w-full rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3.5 py-2 font-mono text-xs text-[var(--asis-text-primary)] placeholder:text-[var(--asis-text-secondary)]/70 focus:border-[var(--asis-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--asis-primary)]/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomModalOpen(false)}
            >
              {t.customCancelBtn}
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {t.customSaveBtn}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
