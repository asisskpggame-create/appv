export type SmartSelectionPolicy =
  | 'automatic'
  | 'lowest_latency'
  | 'specific_country'
  | 'specific_server'
  | 'favorite_server';

export type LatencyMeasurementSource =
  | 'unavailable'
  | 'gateway_tcp_probe'
  | 'unsupported_protocol';

export interface ProbeResultEntry {
  latencyMs: number | null;
  available: boolean;
  error?: string;
  measuredAt: string;
}

export interface ServerCatalogEntry {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  name: string;
  countryCode: string | null;
  countryFlag: string | null;
  countryName: string | null;
  city: string | null;
  group: string;
  protocol: string;
  supported: boolean;
  hostRedacted: string;
  probeHost?: string;
  port: number | null;
  /** null = not yet probed / unknown; never fabricated */
  available: boolean | null;
  /** null = measurement unavailable; distinct from real tunnel RTT */
  probeLatencyMs: number | null;
  measurementSource: LatencyMeasurementSource;
  isCustom?: boolean;
}

export interface CustomServerEntry {
  id: string;
  name: string;
  countryCode: string | null;
  countryFlag: string | null;
  countryName: string | null;
  protocol: string;
  supported: boolean;
  hostRedacted: string;
  probeHost?: string;
  port: number | null;
  createdAt: string;
}

export interface SmartSelectionOutcome {
  selectedServer: ServerCatalogEntry | null;
  policy: SmartSelectionPolicy;
  evaluatedCount: number;
  compatibleCount: number;
  excludedUnsupportedCount: number;
  excludedUnavailableCount: number;
  reasonCode:
    | 'SELECTED_BY_MEASURED_LATENCY'
    | 'SELECTED_COMPATIBLE_NO_LATENCY'
    | 'SELECTED_COUNTRY_MATCH'
    | 'SELECTED_FAVORITE_MATCH'
    | 'SELECTED_SPECIFIC_SERVER'
    | 'NO_SERVERS_AVAILABLE'
    | 'NO_COMPATIBLE_SERVERS'
    | 'NO_LATENCY_MEASUREMENTS'
    | 'NO_MATCHING_COUNTRY'
    | 'NO_FAVORITE_SERVERS';
}
