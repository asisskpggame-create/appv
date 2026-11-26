export type TrafficGranularity = '24h' | '7d' | '30d';

export type TrafficChartSource = 'server_authoritative' | 'local_engine';

export type TrafficChartMode = 'area' | 'bar';

export interface TrafficHistoryPoint {
  /** ISO-8601 UTC timestamp for the aggregation bucket start */
  timestamp: string;
  /** Optional custom short bucket label */
  label?: string;
  /** Download volume in bytes for this bucket */
  downloadBytes: number;
  /** Upload volume in bytes for this bucket */
  uploadBytes: number;
  /** Combined volume in bytes (defaults to downloadBytes + uploadBytes) */
  totalBytes?: number;
}

export interface AuthoritativeUsagePayload {
  source: 'server_authoritative';
  subscriptionId?: string;
  providerInstanceId?: string;
  usedTrafficBytes: number | null;
  dataLimitBytes: number | null;
  downloadTrafficBytes?: number | null;
  uploadTrafficBytes?: number | null;
  expiresAt: string | null;
  recordedAt: string;
  granularity?: TrafficGranularity;
  history?: TrafficHistoryPoint[];
}

export interface TrafficChartDatum {
  timestamp: string;
  label: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  downloadScaled: number;
  uploadScaled: number;
}

export type TrafficScaleUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB';

export interface NormalizedTrafficSeries {
  series: TrafficChartDatum[];
  unit: TrafficScaleUnit;
  divisor: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  totalBytes: number;
  peakBucketBytes: number;
}

export interface QuotaBreakdown {
  totalBytes: number | null;
  usedBytes: number | null;
  remainingBytes: number | null;
  usedPercent: number | null;
}
