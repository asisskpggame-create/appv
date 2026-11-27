import { GatewayError } from '../errors.ts';
import type {
  IntegrationConnectionState,
  PasarGuardInstanceConfig,
  PasarGuardSubscriptionPayload,
  PasarGuardUserRecord,
} from '../types.ts';

export interface PasarGuardAdapter {
  readonly instanceId: string;
  readonly label: string;
  readonly connectionState: IntegrationConnectionState;
  getUserRecord(username: string): Promise<PasarGuardUserRecord>;
  getSubscriptionLinks(username: string): Promise<PasarGuardSubscriptionPayload>;
  verifyHealth(): Promise<{ ok: boolean; status: IntegrationConnectionState; message: string }>;
  /** Subscription-link login (optional capability). Returns the secret token if the link belongs to this instance. */
  parseSubscriptionLink?(rawLink: string): string | null;
  fetchSubscriptionInfo?(token: string): Promise<PasarGuardUserRecord>;
  fetchSubscriptionLinks?(token: string): Promise<PasarGuardSubscriptionPayload>;
}

const UPSTREAM_TIMEOUT_MS = 8_000;
const UPSTREAM_MAX_BYTES = 2 * 1024 * 1024;

function unavailable(message: string): GatewayError {
  return new GatewayError(502, 'PASARGUARD_UPSTREAM_UNAVAILABLE', 'backend_unavailable', message, 'retry_later');
}

/** GET with timeout, no redirects, capped body. Never logs the URL (it carries a secret token). */
async function upstreamGet(url: string, accept: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: accept, 'User-Agent': 'ASiS-Gateway/0.3' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw unavailable('PasarGuard panel is unreachable.');
  }

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new GatewayError(
      401,
      'AUTH_LINK_REJECTED',
      'authentication_failure',
      'The subscription link was not accepted.',
      'verify_credentials',
    );
  }
  if (!res.ok) {
    throw unavailable(`PasarGuard panel answered with HTTP ${res.status}.`);
  }
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > UPSTREAM_MAX_BYTES) throw unavailable('PasarGuard response is too large.');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > UPSTREAM_MAX_BYTES) throw unavailable('PasarGuard response is too large.');
  return Buffer.from(buf).toString('utf8');
}

function toBytes(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Accepts unix seconds, unix milliseconds or ISO strings; 0 / null mean "never". */
function toIso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

const KNOWN_STATUSES = new Set(['active', 'disabled', 'expired', 'limited', 'on_hold']);

/** Maps the public `/sub/{token}/info` JSON (Marzban-compatible) into the gateway record. */
export function mapSubscriptionInfo(raw: unknown, instanceId: string): PasarGuardUserRecord {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const username = typeof o.username === 'string' ? o.username.trim() : '';
  if (!username) {
    throw unavailable('PasarGuard subscription info has an unexpected format.');
  }
  const status = typeof o.status === 'string' && KNOWN_STATUSES.has(o.status) ? o.status : 'disabled';
  const limit = toBytes(o.data_limit);
  return {
    username,
    providerInstanceId: instanceId,
    status: status as PasarGuardUserRecord['status'],
    usedTrafficBytes: toBytes(o.used_traffic) ?? 0,
    dataLimitBytes: limit && limit > 0 ? limit : null,
    expiresAt: toIso(o.expire),
    createdAt: toIso(o.created_at),
  };
}

/** Subscription body is either plain URI lines or Base64 of them. */
export function decodeSubscriptionBody(body: string): string[] {
  const looksLikeUris = (text: string) => /^[a-z][a-z0-9+.-]*:\/\//im.test(text);
  let text = body.trim();
  if (!looksLikeUris(text)) {
    try {
      text = Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8');
    } catch {
      return [];
    }
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[a-z][a-z0-9+.-]*:\/\//i.test(l));
}

/**
 * Default safe adapter when PasarGuard instance URL/credentials are not yet configured.
 * Never fabricates balances, expiry dates, or server links.
 */
export class NotConnectedPasarGuardAdapter implements PasarGuardAdapter {
  public readonly instanceId: string;
  public readonly label: string;
  public readonly connectionState: IntegrationConnectionState = 'NOT_CONNECTED';

  constructor(instanceId = 'default', label = 'Unconfigured PasarGuard Panel') {
    this.instanceId = instanceId;
    this.label = label;
  }

  async getUserRecord(_username: string): Promise<PasarGuardUserRecord> {
    throw new GatewayError(
      503,
      'PASARGUARD_NOT_CONNECTED',
      'backend_unavailable',
      'PasarGuard adapter is NOT CONNECTED. Configure instance endpoint and API documentation.',
      'configure_pasarguard_adapter',
    );
  }

  async getSubscriptionLinks(_username: string): Promise<PasarGuardSubscriptionPayload> {
    throw new GatewayError(
      503,
      'PASARGUARD_NOT_CONNECTED',
      'backend_unavailable',
      'PasarGuard subscription feed is NOT CONNECTED.',
      'configure_pasarguard_adapter',
    );
  }

  async verifyHealth(): Promise<{ ok: boolean; status: IntegrationConnectionState; message: string }> {
    return {
      ok: false,
      status: 'NOT_CONNECTED',
      message: 'Awaiting PasarGuard API documentation, base URL, and service token.',
    };
  }
}

/**
 * Parameterized HTTP adapter for PasarGuard panels.
 * Exact endpoint paths and payload mappings must be finalized once sanitized PasarGuard API docs are supplied.
 */
export class HttpPasarGuardAdapter implements PasarGuardAdapter {
  public readonly instanceId: string;
  public readonly label: string;
  public readonly connectionState: IntegrationConnectionState = 'CONNECTED';
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly subscriptionBase: URL | null;

  constructor(config: PasarGuardInstanceConfig) {
    this.instanceId = config.instanceId;
    this.label = config.label;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.serviceToken = config.serviceToken ?? '';
    try {
      this.subscriptionBase = new URL(
        (config.subscriptionBaseUrl?.trim() || `${this.baseUrl}/sub`).replace(/\/+$/, ''),
      );
    } catch {
      this.subscriptionBase = null;
    }
  }

  private subscriptionPrefix(): { origin: string; path: string } | null {
    if (!this.subscriptionBase) return null;
    return { origin: this.subscriptionBase.origin, path: this.subscriptionBase.pathname.replace(/\/+$/, '') };
  }

  /**
   * Accepts only links on this instance's own subscription prefix (SSRF guard:
   * the gateway never fetches a host the operator did not configure).
   */
  parseSubscriptionLink(rawLink: string): string | null {
    const prefix = this.subscriptionPrefix();
    if (!prefix) return null;
    let url: URL;
    try {
      url = new URL(rawLink.trim());
    } catch {
      return null;
    }
    if (url.username || url.password || url.origin !== prefix.origin) return null;
    if (!url.pathname.startsWith(`${prefix.path}/`)) return null;

    const rest = url.pathname.slice(prefix.path.length + 1).split('/').filter(Boolean);
    if (rest[rest.length - 1] === 'info') rest.pop();
    if (rest.length !== 1) return null;

    let token: string;
    try {
      token = decodeURIComponent(rest[0]);
    } catch {
      return null;
    }
    return token.length >= 8 && token.length <= 2048 && /^[A-Za-z0-9._~-]+$/.test(token) ? token : null;
  }

  async fetchSubscriptionInfo(token: string): Promise<PasarGuardUserRecord> {
    const prefix = this.subscriptionPrefix();
    if (!prefix) throw unavailable(`PasarGuard instance "${this.instanceId}" has an invalid subscription URL.`);
    const body = await upstreamGet(`${prefix.origin}${prefix.path}/${encodeURIComponent(token)}/info`, 'application/json');
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw unavailable('PasarGuard subscription info is not valid JSON.');
    }
    return mapSubscriptionInfo(json, this.instanceId);
  }

  async fetchSubscriptionLinks(token: string): Promise<PasarGuardSubscriptionPayload> {
    const prefix = this.subscriptionPrefix();
    if (!prefix) throw unavailable(`PasarGuard instance "${this.instanceId}" has an invalid subscription URL.`);
    const body = await upstreamGet(`${prefix.origin}${prefix.path}/${encodeURIComponent(token)}`, '*/*');
    return {
      providerInstanceId: this.instanceId,
      rawLinks: decodeSubscriptionBody(body),
      fetchedAt: new Date().toISOString(),
    };
  }

  async getUserRecord(username: string): Promise<PasarGuardUserRecord> {
    if (!this.baseUrl || !this.serviceToken) {
      throw new GatewayError(
        503,
        'PASARGUARD_NOT_CONNECTED',
        'backend_unavailable',
        `PasarGuard instance "${this.instanceId}" is missing server credentials.`,
        'configure_pasarguard_adapter',
      );
    }

    // Endpoint contract pending confirmation from owner's PasarGuard version/docs.
    throw new GatewayError(
      501,
      'PASARGUARD_SCHEMA_PENDING',
      'backend_unavailable',
      `PasarGuard HTTP mapping for "${username}" requires confirmed API schema in PASARGUARD_INTEGRATION.md.`,
      'provide_pasarguard_docs',
    );
  }

  async getSubscriptionLinks(_username: string): Promise<PasarGuardSubscriptionPayload> {
    throw new GatewayError(
      501,
      'PASARGUARD_SCHEMA_PENDING',
      'backend_unavailable',
      'PasarGuard subscription link mapping requires confirmed API schema.',
      'provide_pasarguard_docs',
    );
  }

  async verifyHealth(): Promise<{ ok: boolean; status: IntegrationConnectionState; message: string }> {
    return {
      ok: true,
      status: 'CONNECTED',
      message: `Instance "${this.instanceId}": subscription-link login enabled; admin API mapping pending.`,
    };
  }
}

export class PasarGuardAdapterRegistry {
  private readonly adapters = new Map<string, PasarGuardAdapter>();

  constructor(instances: PasarGuardInstanceConfig[]) {
    if (instances.length === 0) {
      this.adapters.set('default', new NotConnectedPasarGuardAdapter());
      return;
    }

    for (const instance of instances) {
      this.adapters.set(instance.instanceId, new HttpPasarGuardAdapter(instance));
    }
  }

  /** Finds the instance whose subscription prefix matches the pasted link. */
  findForLink(rawLink: string): { adapter: PasarGuardAdapter; token: string } | null {
    for (const adapter of this.adapters.values()) {
      const token = adapter.parseSubscriptionLink?.(rawLink);
      if (token) return { adapter, token };
    }
    return null;
  }

  getAdapter(instanceId = 'default'): PasarGuardAdapter {
    return this.adapters.get(instanceId) ?? new NotConnectedPasarGuardAdapter(instanceId);
  }

  listSummaries(): Array<{ instanceId: string; label: string; status: IntegrationConnectionState }> {
    return Array.from(this.adapters.values()).map((adapter) => ({
      instanceId: adapter.instanceId,
      label: adapter.label,
      status: adapter.connectionState,
    }));
  }
}

export function loadPasarGuardRegistryFromEnv(): PasarGuardAdapterRegistry {
  const rawJson = process.env.PASARGUARD_INSTANCES_JSON?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as PasarGuardInstanceConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new PasarGuardAdapterRegistry(parsed);
      }
    } catch {
      // Fall through to single-instance check or NOT_CONNECTED default
    }
  }

  const singleUrl = process.env.PASARGUARD_BASE_URL?.trim();
  const singleToken = process.env.PASARGUARD_SERVICE_TOKEN?.trim();
  if (singleUrl) {
    return new PasarGuardAdapterRegistry([
      {
        instanceId: 'primary',
        label: 'Primary PasarGuard Instance',
        baseUrl: singleUrl,
        serviceToken: singleToken || undefined,
        subscriptionBaseUrl: process.env.PASARGUARD_SUBSCRIPTION_BASE_URL?.trim() || undefined,
      },
    ]);
  }

  return new PasarGuardAdapterRegistry([]);
}
