export type SubscriptionSource = 'account' | 'manual_import';

export type SubscriptionType =
  | 'time'
  | 'traffic'
  | 'combined'
  | 'unlimited'
  | 'trial'
  | 'custom';

export type SubscriptionStatus =
  | 'active'
  | 'expired'
  | 'exhausted'
  | 'suspended'
  | 'unverified';

export interface ParsedEndpointSummary {
  id: string;
  name: string;
  protocol: string;
  supported: boolean;
  hostRedacted: string;
  probeHost?: string;
  port: number | null;
  countryHint: string | null;
}

export interface SubscriptionRecord {
  id: string;
  source: SubscriptionSource;
  /** Gateway instance an account subscription comes from. */
  providerInstanceId?: string;
  importMethod?: 'url' | 'clipboard' | 'qr' | 'file';
  name: string;
  type: SubscriptionType;
  status: SubscriptionStatus;
  /** SHA-256 fingerprint for duplicate detection without storing/logging raw URL */
  fingerprintHash: string;
  /** Authoritative server values; null means not provided / unavailable */
  totalBytes: number | null;
  usedBytes: number | null;
  remainingBytes: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  allowedDevices: number | null;
  locations: string[];
  endpoints: ParsedEndpointSummary[];
  lastSyncedAt: string;
  renewalAvailable: boolean;
  renewalUrl?: string | null;
}
