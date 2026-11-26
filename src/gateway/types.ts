export type IntegrationConnectionState = 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR';

export type ErrorCategory =
  | 'validation_error'
  | 'authentication_failure'
  | 'account_suspended'
  | 'subscription_expired'
  | 'traffic_limit_reached'
  | 'invalid_configuration'
  | 'unsupported_protocol'
  | 'server_unreachable'
  | 'dns_failure'
  | 'tls_handshake_failure'
  | 'permission_denied'
  | 'session_expired'
  | 'rate_limited'
  | 'backend_unavailable';

export interface GatewayErrorEnvelope {
  error: {
    code: string;
    category: ErrorCategory;
    message: string;
    diagnosticId: string;
    recoveryAction?: string;
  };
}

export interface PasarGuardInstanceConfig {
  instanceId: string;
  label: string;
  baseUrl: string;
  serviceToken: string;
}

export type TrafficGranularity = '24h' | '7d' | '30d';

export interface TrafficHistoryBucket {
  timestamp: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
}

export interface AuthoritativeUsageSnapshot {
  source: 'server_authoritative';
  subscriptionId?: string;
  providerInstanceId: string;
  usedTrafficBytes: number | null;
  dataLimitBytes: number | null;
  downloadTrafficBytes: number | null;
  uploadTrafficBytes: number | null;
  expiresAt: string | null;
  recordedAt: string;
  granularity: TrafficGranularity;
  history: TrafficHistoryBucket[];
}

export interface PasarGuardUserRecord {
  username: string;
  providerInstanceId: string;
  status: 'active' | 'disabled' | 'expired' | 'limited' | 'on_hold';
  usedTrafficBytes: number;
  dataLimitBytes: number | null;
  downloadTrafficBytes?: number | null;
  uploadTrafficBytes?: number | null;
  usageHistory?: TrafficHistoryBucket[];
  expiresAt: string | null;
  subscriptionUrl?: string;
}

export interface PasarGuardSubscriptionPayload {
  providerInstanceId: string;
  rawLinks: string[];
  fetchedAt: string;
}

export interface ResellerCustomerRecord {
  customerId: string;
  username: string;
  status: 'active' | 'suspended';
  allowedDevices: number;
  renewalUrl?: string;
}

export interface ResellerPurchasedService {
  serviceId: string;
  name: string;
  providerInstanceId: string;
  externalUsername: string;
  type: 'time' | 'traffic' | 'combined' | 'unlimited' | 'trial' | 'custom';
  status: 'active' | 'expired' | 'exhausted' | 'suspended';
  startsAt: string | null;
  expiresAt: string | null;
  totalBytes: number | null;
  usedBytes: number;
  allowedDevices: number;
  renewalAvailable: boolean;
}

export interface NormalizedSubscription {
  id: string;
  source: 'account' | 'manual_import';
  providerInstanceId?: string;
  name: string;
  type: 'time' | 'traffic' | 'combined' | 'unlimited' | 'trial' | 'custom';
  status: 'active' | 'expired' | 'exhausted' | 'suspended';
  totalBytes: number | null;
  usedBytes: number;
  remainingBytes: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  allowedDevices: number;
  locations: string[];
  lastSyncedAt: string;
  renewalInfo?: {
    available: boolean;
    renewalUrl?: string;
  };
}

export interface NormalizedServer {
  id: string;
  subscriptionId: string;
  name: string;
  countryCode: string;
  countryName: string;
  city: string;
  protocols: string[];
  group: string;
  available: boolean;
  gatewayProbeLatencyMs: number | null;
}

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  platform: 'android' | 'ios' | 'windows' | 'web';
  appVersion: string;
  lastSeenAt: string;
  revokedAt: string | null;
  currentDevice?: boolean;
}

export interface AppVersionInfo {
  platform: 'android' | 'ios' | 'windows' | 'web';
  latestVersion: string;
  minimumSupportedVersion: string;
  mandatoryUpdate: boolean;
  optionalUpdate: boolean;
  releaseNotes: string;
  updateUrl: string | null;
  checksumSha256: string | null;
}

export interface SupportPayload {
  integrationStatus: IntegrationConnectionState;
  contactEmail: string | null;
  supportPortalUrl: string | null;
  faqs: Array<{ id: string; question: string; answer: string }>;
  ticketEndpointAvailable: boolean;
}

export interface AdapterHealthSummary {
  pasarguard: {
    status: IntegrationConnectionState;
    configuredInstances: Array<{ instanceId: string; label: string }>;
    message: string;
  };
  reseller: {
    status: IntegrationConnectionState;
    message: string;
  };
}
