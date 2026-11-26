import type { SubscriptionRecord } from '../subscriptions';
import type {
  CustomServerEntry,
  ProbeResultEntry,
  ServerCatalogEntry,
  SmartSelectionOutcome,
  SmartSelectionPolicy,
} from './types';

export type LatencyTier = 'fast' | 'medium' | 'slow' | 'unreachable' | 'untested';

export function getLatencyTier(
  latencyMs: number | null,
  available: boolean | null,
): LatencyTier {
  if (available === false) return 'unreachable';
  if (latencyMs === null || !Number.isFinite(latencyMs)) return 'untested';
  if (latencyMs <= 110) return 'fast';
  if (latencyMs <= 260) return 'medium';
  return 'slow';
}

export interface CountryMetadataOption {
  code: string;
  flag: string;
  nameEn: string;
  nameFa: string;
  keywords: RegExp;
}

export const SUPPORTED_COUNTRY_OPTIONS: CountryMetadataOption[] = [
  { code: 'DE', flag: '🇩🇪', nameEn: 'Germany', nameFa: 'آلمان', keywords: /🇩🇪|\b(DE|GER|Germany|Frankfurt|Berlin|Munich)\b|آلمان|فرانکفورت/i },
  { code: 'NL', flag: '🇳🇱', nameEn: 'Netherlands', nameFa: 'هلند', keywords: /🇳🇱|\b(NL|NLD|Netherlands|Amsterdam)\b|هلند|آمستردام/i },
  { code: 'FR', flag: '🇫🇷', nameEn: 'France', nameFa: 'فرانسه', keywords: /🇫🇷|\b(FR|FRA|France|Paris)\b|فرانسه|پاریس/i },
  { code: 'GB', flag: '🇬🇧', nameEn: 'United Kingdom', nameFa: 'انگلیس', keywords: /🇬🇧|\b(GB|UK|London|Manchester|Britain)\b|انگلیس|بریتانیا|لندن/i },
  { code: 'US', flag: '🇺🇸', nameEn: 'United States', nameFa: 'آمریکا', keywords: /🇺🇸|\b(US|USA|New\s*York|Dallas|Miami|Los\s*Angeles|Virginia|Chicago|Seattle)\b|آمریکا|ایالات متحده/i },
  { code: 'TR', flag: '🇹🇷', nameEn: 'Turkey', nameFa: 'ترکیه', keywords: /🇹🇷|\b(TR|TUR|Turkey|Istanbul|Ankara|Izmir)\b|ترکیه|استانبول/i },
  { code: 'FI', flag: '🇫🇮', nameEn: 'Finland', nameFa: 'فنلاند', keywords: /🇫🇮|\b(FI|FIN|Finland|Helsinki)\b|فنلاند|هلسینکی/i },
  { code: 'SE', flag: '🇸🇪', nameEn: 'Sweden', nameFa: 'سوئد', keywords: /🇸🇪|\b(SE|SWE|Sweden|Stockholm)\b|سوئد|استکهلم/i },
  { code: 'CH', flag: '🇨🇭', nameEn: 'Switzerland', nameFa: 'سوئیس', keywords: /🇨🇭|\b(CH|CHE|Switzerland|Zurich|Geneva)\b|سوئیس|زوریخ/i },
  { code: 'CA', flag: '🇨🇦', nameEn: 'Canada', nameFa: 'کانادا', keywords: /🇨🇦|\b(CA|CAN|Canada|Toronto|Montreal|Vancouver)\b|کانادا|تورنتو/i },
  { code: 'AE', flag: '🇦🇪', nameEn: 'United Arab Emirates', nameFa: 'امارات', keywords: /🇦🇪|\b(AE|UAE|Dubai|Abu\s*Dhabi)\b|امارات|دبی/i },
  { code: 'SG', flag: '🇸🇬', nameEn: 'Singapore', nameFa: 'سنگاپور', keywords: /🇸🇬|\b(SG|SGP|Singapore)\b|سنگاپور/i },
  { code: 'JP', flag: '🇯🇵', nameEn: 'Japan', nameFa: 'ژاپن', keywords: /🇯🇵|\b(JP|JPN|Japan|Tokyo|Osaka)\b|ژاپن|توکیو/i },
  { code: 'AT', flag: '🇦🇹', nameEn: 'Austria', nameFa: 'اتریش', keywords: /🇦🇹|\b(AT|AUT|Austria|Vienna)\b|اتریش|وین/i },
  { code: 'IT', flag: '🇮🇹', nameEn: 'Italy', nameFa: 'ایتالیا', keywords: /🇮🇹|\b(IT|ITA|Italy|Milan|Rome)\b|ایتالیا|میلان|رم/i },
  { code: 'ES', flag: '🇪🇸', nameEn: 'Spain', nameFa: 'اسپانیا', keywords: /🇪🇸|\b(ES|ESP|Spain|Madrid|Barcelona)\b|اسپانیا|مادرید/i },
  { code: 'PL', flag: '🇵🇱', nameEn: 'Poland', nameFa: 'لهستان', keywords: /🇵🇱|\b(PL|POL|Poland|Warsaw)\b|لهستان|ورشو/i },
  { code: 'RU', flag: '🇷🇺', nameEn: 'Russia', nameFa: 'روسیه', keywords: /🇷🇺|\b(RU|RUS|Russia|Moscow|Saint\s*Petersburg)\b|روسیه|مسکو/i },
  { code: 'NO', flag: '🇳🇴', nameEn: 'Norway', nameFa: 'نروژ', keywords: /🇳🇴|\b(NO|NOR|Norway|Oslo)\b|نروژ|اسلو/i },
  { code: 'RO', flag: '🇷🇴', nameEn: 'Romania', nameFa: 'رومانی', keywords: /🇷🇴|\b(RO|ROU|Romania|Bucharest)\b|رومانی|بخارست/i },
  { code: 'UA', flag: '🇺🇦', nameEn: 'Ukraine', nameFa: 'اوکراین', keywords: /🇺🇦|\b(UA|UKR|Ukraine|Kyiv)\b|اوکراین/i },
  { code: 'BG', flag: '🇧🇬', nameEn: 'Bulgaria', nameFa: 'بلغارستان', keywords: /🇧🇬|\b(BG|BGR|Bulgaria|Sofia)\b|بلغارستان|صوفیه/i },
  { code: 'BE', flag: '🇧🇪', nameEn: 'Belgium', nameFa: 'بلژیک', keywords: /🇧🇪|\b(BE|BEL|Belgium|Brussels)\b|بلژیک/i },
  { code: 'IE', flag: '🇮🇪', nameEn: 'Ireland', nameFa: 'ایرلند', keywords: /🇮🇪|\b(IE|IRL|Ireland|Dublin)\b|ایرلند/i },
  { code: 'HK', flag: '🇭🇰', nameEn: 'Hong Kong', nameFa: 'هنگ کنگ', keywords: /🇭🇰|\b(HK|HKG|Hong\s*Kong)\b|هنگ\s*کنگ/i },
  { code: 'KR', flag: '🇰🇷', nameEn: 'South Korea', nameFa: 'کره جنوبی', keywords: /🇰🇷|\b(KR|KOR|Korea|Seoul)\b|کره/i },
  { code: 'IN', flag: '🇮🇳', nameEn: 'India', nameFa: 'هند', keywords: /🇮🇳|\b(IN|IND|India|Mumbai|Delhi|Bangalore)\b|هند/i },
  { code: 'AU', flag: '🇦🇺', nameEn: 'Australia', nameFa: 'استرالیا', keywords: /🇦🇺|\b(AU|AUS|Australia|Sydney|Melbourne)\b|استرالیا/i },
  { code: 'BR', flag: '🇧🇷', nameEn: 'Brazil', nameFa: 'برزیل', keywords: /🇧🇷|\b(BR|BRA|Brazil|Sao\s*Paulo)\b|برزیل/i },
  { code: 'IR', flag: '🇮🇷', nameEn: 'Iran', nameFa: 'ایران', keywords: /🇮🇷|\b(IR|IRN|Iran|Tehran)\b|ایران|تهران/i },
];

export function resolveCountryByCode(code: string | null | undefined): CountryMetadataOption | null {
  if (!code) return null;
  const upper = code.toUpperCase().trim();
  return SUPPORTED_COUNTRY_OPTIONS.find((c) => c.code === upper) ?? null;
}

function extractUnicodeFlagEmoji(text: string): { code: string; flag: string } | null {
  const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (!match) return null;
  const chars = Array.from(match[0]);
  if (chars.length !== 2) return null;
  const code = chars
    .map((ch) => String.fromCharCode((ch.codePointAt(0) ?? 0) - 0x1f1e6 + 65))
    .join('');
  return { code, flag: match[0] };
}

export function inferCountryMetadata(nodeName: string): {
  countryCode: string | null;
  countryFlag: string | null;
  countryName: string | null;
} {
  for (const item of SUPPORTED_COUNTRY_OPTIONS) {
    if (item.keywords.test(nodeName)) {
      return {
        countryCode: item.code,
        countryFlag: item.flag,
        countryName: item.nameEn,
      };
    }
  }

  const unicodeFlag = extractUnicodeFlagEmoji(nodeName);
  if (unicodeFlag) {
    const known = resolveCountryByCode(unicodeFlag.code);
    return {
      countryCode: unicodeFlag.code,
      countryFlag: unicodeFlag.flag,
      countryName: known?.nameEn ?? unicodeFlag.code,
    };
  }

  return { countryCode: null, countryFlag: null, countryName: null };
}

export function buildServerCatalogFromSubscriptions(
  subscriptions: SubscriptionRecord[],
  customServers: CustomServerEntry[] = [],
  probeResults: Record<string, ProbeResultEntry> = {},
): ServerCatalogEntry[] {
  const entries: ServerCatalogEntry[] = [];

  for (const custom of customServers) {
    const inferred = custom.countryCode
      ? resolveCountryByCode(custom.countryCode)
      : null;
    const probe = probeResults[custom.id];
    const available = !custom.supported
      ? false
      : probe
        ? probe.available
        : null;
    const probeLatencyMs = custom.supported && probe ? probe.latencyMs : null;
    const measurementSource = !custom.supported
      ? 'unsupported_protocol'
      : probe
        ? 'gateway_tcp_probe'
        : 'unavailable';

    entries.push({
      id: custom.id,
      subscriptionId: 'custom_locations',
      subscriptionName: 'Custom Locations',
      name: custom.name,
      countryCode: custom.countryCode,
      countryFlag: custom.countryFlag ?? inferred?.flag ?? null,
      countryName: custom.countryName ?? inferred?.nameEn ?? null,
      city: null,
      group: 'Custom',
      protocol: custom.protocol,
      supported: custom.supported,
      hostRedacted: custom.hostRedacted,
      probeHost: custom.probeHost,
      port: custom.port,
      available,
      probeLatencyMs,
      measurementSource,
      isCustom: true,
    });
  }

  for (const sub of subscriptions) {
    if (sub.status === 'expired' || sub.status === 'exhausted' || sub.status === 'suspended') {
      continue;
    }

    for (const ep of sub.endpoints) {
      const country = inferCountryMetadata(ep.name);
      const id = `${sub.id}:${ep.id}`;
      const probe = probeResults[id];
      const available = !ep.supported
        ? false
        : probe
          ? probe.available
          : null;
      const probeLatencyMs = ep.supported && probe ? probe.latencyMs : null;
      const measurementSource = !ep.supported
        ? 'unsupported_protocol'
        : probe
          ? 'gateway_tcp_probe'
          : 'unavailable';

      entries.push({
        id,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        name: ep.name,
        countryCode: country.countryCode,
        countryFlag: country.countryFlag,
        countryName: country.countryName,
        city: null,
        group: sub.name,
        protocol: ep.protocol,
        supported: ep.supported,
        hostRedacted: ep.hostRedacted,
        probeHost: ep.probeHost,
        port: ep.port,
        available,
        probeLatencyMs,
        measurementSource,
        isCustom: false,
      });
    }
  }

  return entries;
}

export function evaluateSmartSelection(
  servers: ServerCatalogEntry[],
  policy: SmartSelectionPolicy,
  options: {
    favoriteIds: Set<string>;
    targetCountryCode?: string | null;
    targetServerId?: string | null;
  },
): SmartSelectionOutcome {
  if (servers.length === 0) {
    return {
      selectedServer: null,
      policy,
      evaluatedCount: 0,
      compatibleCount: 0,
      excludedUnsupportedCount: 0,
      excludedUnavailableCount: 0,
      reasonCode: 'NO_SERVERS_AVAILABLE',
    };
  }

  let excludedUnsupportedCount = 0;
  let excludedUnavailableCount = 0;
  const compatible: ServerCatalogEntry[] = [];

  for (const srv of servers) {
    if (!srv.supported) {
      excludedUnsupportedCount += 1;
      continue;
    }
    if (srv.available === false) {
      excludedUnavailableCount += 1;
      continue;
    }
    compatible.push(srv);
  }

  if (compatible.length === 0) {
    return {
      selectedServer: null,
      policy,
      evaluatedCount: servers.length,
      compatibleCount: 0,
      excludedUnsupportedCount,
      excludedUnavailableCount,
      reasonCode: 'NO_COMPATIBLE_SERVERS',
    };
  }

  const base = {
    policy,
    evaluatedCount: servers.length,
    compatibleCount: compatible.length,
    excludedUnsupportedCount,
    excludedUnavailableCount,
  };

  if (policy === 'specific_server') {
    const match = compatible.find((s) => s.id === options.targetServerId) ?? null;
    return {
      ...base,
      selectedServer: match,
      reasonCode: match ? 'SELECTED_SPECIFIC_SERVER' : 'NO_COMPATIBLE_SERVERS',
    };
  }

  if (policy === 'specific_country') {
    const byCountry = compatible.filter(
      (s) => s.countryCode && s.countryCode === options.targetCountryCode,
    );
    if (byCountry.length === 0) {
      return { ...base, selectedServer: null, reasonCode: 'NO_MATCHING_COUNTRY' };
    }
    const sorted = sortByLatencyThenName(byCountry);
    return { ...base, selectedServer: sorted[0], reasonCode: 'SELECTED_COUNTRY_MATCH' };
  }

  if (policy === 'favorite_server') {
    const favorites = compatible.filter((s) => options.favoriteIds.has(s.id));
    if (favorites.length === 0) {
      return { ...base, selectedServer: null, reasonCode: 'NO_FAVORITE_SERVERS' };
    }
    const sorted = sortByLatencyThenName(favorites);
    return { ...base, selectedServer: sorted[0], reasonCode: 'SELECTED_FAVORITE_MATCH' };
  }

  if (policy === 'lowest_latency') {
    const measured = compatible
      .filter((s) => s.probeLatencyMs !== null)
      .sort((a, b) => (a.probeLatencyMs ?? Infinity) - (b.probeLatencyMs ?? Infinity));
    if (measured.length === 0) {
      return { ...base, selectedServer: null, reasonCode: 'NO_LATENCY_MEASUREMENTS' };
    }
    return { ...base, selectedServer: measured[0], reasonCode: 'SELECTED_BY_MEASURED_LATENCY' };
  }

  // Automatic: prefer measured lowest-latency, prioritizing favorites on tie; fall back to first compatible when latency unavailable
  const measured = compatible
    .filter((s) => s.probeLatencyMs !== null)
    .sort((a, b) => {
      const latDiff = (a.probeLatencyMs ?? Infinity) - (b.probeLatencyMs ?? Infinity);
      if (latDiff !== 0) return latDiff;
      const favA = options.favoriteIds.has(a.id) ? 0 : 1;
      const favB = options.favoriteIds.has(b.id) ? 0 : 1;
      return favA - favB;
    });

  if (measured.length > 0) {
    return { ...base, selectedServer: measured[0], reasonCode: 'SELECTED_BY_MEASURED_LATENCY' };
  }

  const favFallback = compatible.find((s) => options.favoriteIds.has(s.id));
  return {
    ...base,
    selectedServer: favFallback ?? compatible[0],
    reasonCode: 'SELECTED_COMPATIBLE_NO_LATENCY',
  };
}

function sortByLatencyThenName(list: ServerCatalogEntry[]): ServerCatalogEntry[] {
  return [...list].sort((a, b) => {
    if (a.probeLatencyMs !== null && b.probeLatencyMs !== null) {
      return a.probeLatencyMs - b.probeLatencyMs;
    }
    if (a.probeLatencyMs !== null) return -1;
    if (b.probeLatencyMs !== null) return 1;
    return a.name.localeCompare(b.name);
  });
}
