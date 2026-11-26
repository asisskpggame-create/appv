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

  constructor(config: PasarGuardInstanceConfig) {
    this.instanceId = config.instanceId;
    this.label = config.label;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.serviceToken = config.serviceToken;
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
      ok: false,
      status: 'CONNECTED',
      message: `Instance "${this.instanceId}" configured; awaiting verified PasarGuard API schema mapping.`,
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
  if (singleUrl && singleToken) {
    return new PasarGuardAdapterRegistry([
      {
        instanceId: 'primary',
        label: 'Primary PasarGuard Instance',
        baseUrl: singleUrl,
        serviceToken: singleToken,
      },
    ]);
  }

  return new PasarGuardAdapterRegistry([]);
}
