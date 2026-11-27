export type SmartSelectionPolicy =
  | 'automatic'
  | 'lowest_latency'
  | 'specific_country'
  | 'specific_server'
  | 'favorite_server';

export type LatencyMeasurementSource =
  | 'unavailable'
  | 'gateway_tcp_probe'
  | 'phone_tcp_probe'
  | 'unsupported_protocol';

/**
 * direct: the client connects straight to the exit server.
 * tunnel: the client connects to an entry server (e.g. inside Iran) that relays
 * traffic to a foreign exit server. countryCode then describes the EXIT country.
 */
export type ServerRouteKind = 'direct' | 'tunnel';

export interface ProbeResultEntry {
  latencyMs: number | null;
  available: boolean;
  error?: string;
  measuredAt: string;
  /** Where the number came from; absent = gateway (older stored results). */
  source?: LatencyMeasurementSource;
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
  /** Defaults to 'direct' when absent. */
  route?: ServerRouteKind;
  /** Country of the entry server for tunnel routes (what probeHost points at). */
  entryCountryCode?: string | null;
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
  route?: ServerRouteKind;
  entryCountryCode?: string | null;
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
