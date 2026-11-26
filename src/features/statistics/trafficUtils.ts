import type {
  AuthoritativeUsagePayload,
  QuotaBreakdown,
  TrafficChartDatum,
  TrafficGranularity,
  TrafficHistoryPoint,
  TrafficScaleUnit,
  NormalizedTrafficSeries,
} from './types.ts';

const UNIT_STEPS: Array<{ unit: TrafficScaleUnit; divisor: number }> = [
  { unit: 'TB', divisor: 1024 ** 4 },
  { unit: 'GB', divisor: 1024 ** 3 },
  { unit: 'MB', divisor: 1024 ** 2 },
  { unit: 'KB', divisor: 1024 },
  { unit: 'B', divisor: 1 },
];

export function parseTrafficGranularity(raw?: string | null): TrafficGranularity {
  if (raw === '24h' || raw === '30d') {
    return raw;
  }
  return '7d';
}

export function selectTrafficScaleUnit(maxBytes: number): {
  unit: TrafficScaleUnit;
  divisor: number;
} {
  const safeMax = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 0;
  for (const step of UNIT_STEPS) {
    if (safeMax >= step.divisor) {
      return step;
    }
  }
  return { unit: 'MB', divisor: 1024 ** 2 };
}

export function formatBucketTimestamp(
  timestamp: string,
  granularity: TrafficGranularity,
  locale: 'en-US' | 'fa-IR',
): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  try {
    if (granularity === '24h') {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    }
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return timestamp.slice(0, 10);
  }
}

function roundScaled(bytes: number, divisor: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0 || divisor <= 0) {
    return 0;
  }
  return Math.round((bytes / divisor) * 100) / 100;
}

export function normalizeUsageHistory(
  points: TrafficHistoryPoint[],
  granularity: TrafficGranularity,
  locale: 'en-US' | 'fa-IR' = 'en-US',
): NormalizedTrafficSeries {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      series: [],
      unit: 'MB',
      divisor: 1024 ** 2,
      totalDownloadBytes: 0,
      totalUploadBytes: 0,
      totalBytes: 0,
      peakBucketBytes: 0,
    };
  }

  const sanitized = points
    .filter((pt) => pt && typeof pt.timestamp === 'string' && pt.timestamp.trim().length > 0)
    .map((pt) => {
      const downloadBytes =
        typeof pt.downloadBytes === 'number' && Number.isFinite(pt.downloadBytes)
          ? Math.max(0, pt.downloadBytes)
          : 0;
      const uploadBytes =
        typeof pt.uploadBytes === 'number' && Number.isFinite(pt.uploadBytes)
          ? Math.max(0, pt.uploadBytes)
          : 0;
      const totalBytes =
        typeof pt.totalBytes === 'number' && Number.isFinite(pt.totalBytes)
          ? Math.max(0, pt.totalBytes)
          : downloadBytes + uploadBytes;
      return {
        timestamp: pt.timestamp,
        label: pt.label?.trim() || formatBucketTimestamp(pt.timestamp, granularity, locale),
        downloadBytes,
        uploadBytes,
        totalBytes,
      };
    });

  let maxChannelBytes = 0;
  let totalDownloadBytes = 0;
  let totalUploadBytes = 0;
  let peakBucketBytes = 0;

  for (const item of sanitized) {
    maxChannelBytes = Math.max(maxChannelBytes, item.downloadBytes, item.uploadBytes);
    totalDownloadBytes += item.downloadBytes;
    totalUploadBytes += item.uploadBytes;
    peakBucketBytes = Math.max(peakBucketBytes, item.totalBytes);
  }

  const { unit, divisor } = selectTrafficScaleUnit(maxChannelBytes);

  const series: TrafficChartDatum[] = sanitized.map((item) => ({
    ...item,
    downloadScaled: roundScaled(item.downloadBytes, divisor),
    uploadScaled: roundScaled(item.uploadBytes, divisor),
  }));

  return {
    series,
    unit,
    divisor,
    totalDownloadBytes,
    totalUploadBytes,
    totalBytes: totalDownloadBytes + totalUploadBytes,
    peakBucketBytes,
  };
}

export function normalizeAuthoritativeUsageResponse(
  raw: unknown,
  fallbackGranularity: TrafficGranularity = '7d',
): AuthoritativeUsagePayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.recordedAt !== 'string') {
    return null;
  }

  const historyRaw = Array.isArray(obj.history) ? obj.history : [];
  const history: TrafficHistoryPoint[] = historyRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .filter((entry) => typeof entry.timestamp === 'string' && entry.timestamp.trim().length > 0)
    .map((entry) => {
      const downloadBytes =
        typeof entry.downloadBytes === 'number' && Number.isFinite(entry.downloadBytes)
          ? Math.max(0, entry.downloadBytes)
          : 0;
      const uploadBytes =
        typeof entry.uploadBytes === 'number' && Number.isFinite(entry.uploadBytes)
          ? Math.max(0, entry.uploadBytes)
          : 0;
      const totalBytes =
        typeof entry.totalBytes === 'number' && Number.isFinite(entry.totalBytes)
          ? Math.max(0, entry.totalBytes)
          : downloadBytes + uploadBytes;
      return {
        timestamp: String(entry.timestamp),
        label: typeof entry.label === 'string' ? entry.label : undefined,
        downloadBytes,
        uploadBytes,
        totalBytes,
      };
    });

  return {
    source: 'server_authoritative',
    subscriptionId: typeof obj.subscriptionId === 'string' ? obj.subscriptionId : undefined,
    providerInstanceId:
      typeof obj.providerInstanceId === 'string' ? obj.providerInstanceId : undefined,
    usedTrafficBytes:
      typeof obj.usedTrafficBytes === 'number' && Number.isFinite(obj.usedTrafficBytes)
        ? Math.max(0, obj.usedTrafficBytes)
        : null,
    dataLimitBytes:
      typeof obj.dataLimitBytes === 'number' && Number.isFinite(obj.dataLimitBytes)
        ? Math.max(0, obj.dataLimitBytes)
        : null,
    downloadTrafficBytes:
      typeof obj.downloadTrafficBytes === 'number' && Number.isFinite(obj.downloadTrafficBytes)
        ? Math.max(0, obj.downloadTrafficBytes)
        : null,
    uploadTrafficBytes:
      typeof obj.uploadTrafficBytes === 'number' && Number.isFinite(obj.uploadTrafficBytes)
        ? Math.max(0, obj.uploadTrafficBytes)
        : null,
    expiresAt: typeof obj.expiresAt === 'string' ? obj.expiresAt : null,
    recordedAt: obj.recordedAt,
    granularity: parseTrafficGranularity(
      typeof obj.granularity === 'string' ? obj.granularity : fallbackGranularity,
    ),
    history,
  };
}

export function computeQuotaBreakdown(
  totalBytes: number | null,
  usedBytes: number | null,
  fallbackRemainingBytes: number | null = null,
): QuotaBreakdown {
  const safeTotal =
    typeof totalBytes === 'number' && Number.isFinite(totalBytes) && totalBytes >= 0
      ? totalBytes
      : null;
  const safeUsed =
    typeof usedBytes === 'number' && Number.isFinite(usedBytes) && usedBytes >= 0
      ? usedBytes
      : null;

  const remainingBytes =
    safeTotal !== null && safeUsed !== null
      ? Math.max(0, safeTotal - safeUsed)
      : fallbackRemainingBytes;

  const usedPercent =
    safeTotal !== null && safeTotal > 0 && safeUsed !== null
      ? Math.min(100, Math.round((safeUsed / safeTotal) * 1000) / 10)
      : null;

  return {
    totalBytes: safeTotal,
    usedBytes: safeUsed,
    remainingBytes,
    usedPercent,
  };
}
