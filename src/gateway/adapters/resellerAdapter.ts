import { GatewayError } from '../errors.ts';
import type {
  IntegrationConnectionState,
  ResellerCustomerRecord,
  ResellerPurchasedService,
} from '../types.ts';

export interface ResellerAdapter {
  readonly connectionState: IntegrationConnectionState;
  authenticateEndUser(username: string, password: string): Promise<ResellerCustomerRecord>;
  getCustomerProfile(username: string): Promise<ResellerCustomerRecord>;
  getPurchasedServices(customerId: string): Promise<ResellerPurchasedService[]>;
  requestPasswordRecovery(username: string): Promise<{ delegated: boolean; workflowMessage: string }>;
  verifyHealth(): Promise<{ ok: boolean; status: IntegrationConnectionState; message: string }>;
}

/**
 * Default safe adapter when the Reseller API URL/key is not configured.
 * Never fakes authentication or purchased services.
 */
export class NotConnectedResellerAdapter implements ResellerAdapter {
  public readonly connectionState: IntegrationConnectionState = 'NOT_CONNECTED';

  async authenticateEndUser(_username: string, _password: string): Promise<ResellerCustomerRecord> {
    throw new GatewayError(
      503,
      'RESELLER_NOT_CONNECTED',
      'backend_unavailable',
      'Reseller authentication adapter is NOT CONNECTED. Awaiting Reseller API configuration.',
      'configure_reseller_adapter',
    );
  }

  async getCustomerProfile(_username: string): Promise<ResellerCustomerRecord> {
    throw new GatewayError(
      503,
      'RESELLER_NOT_CONNECTED',
      'backend_unavailable',
      'Reseller customer adapter is NOT CONNECTED.',
      'configure_reseller_adapter',
    );
  }

  async getPurchasedServices(_customerId: string): Promise<ResellerPurchasedService[]> {
    throw new GatewayError(
      503,
      'RESELLER_NOT_CONNECTED',
      'backend_unavailable',
      'Reseller services adapter is NOT CONNECTED.',
      'configure_reseller_adapter',
    );
  }

  async requestPasswordRecovery(_username: string): Promise<{ delegated: boolean; workflowMessage: string }> {
    throw new GatewayError(
      503,
      'RESELLER_NOT_CONNECTED',
      'backend_unavailable',
      'Reseller password recovery workflow is NOT CONNECTED.',
      'configure_reseller_adapter',
    );
  }

  async verifyHealth(): Promise<{ ok: boolean; status: IntegrationConnectionState; message: string }> {
    return {
      ok: false,
      status: 'NOT_CONNECTED',
      message: 'Awaiting Reseller API documentation, base URL, and service credentials.',
    };
  }
}

export class HttpResellerAdapter implements ResellerAdapter {
  public readonly connectionState: IntegrationConnectionState = 'CONNECTED';
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async authenticateEndUser(_username: string, _password: string): Promise<ResellerCustomerRecord> {
    if (!this.baseUrl || !this.apiKey) {
      throw new GatewayError(
        503,
        'RESELLER_NOT_CONNECTED',
        'backend_unavailable',
        'Reseller adapter credentials are missing.',
        'configure_reseller_adapter',
      );
    }

    throw new GatewayError(
      501,
      'RESELLER_SCHEMA_PENDING',
      'backend_unavailable',
      'Reseller authentication endpoint mapping requires confirmed API schema in RESELLER_INTEGRATION.md.',
      'provide_reseller_docs',
    );
  }

  async getCustomerProfile(_username: string): Promise<ResellerCustomerRecord> {
    throw new GatewayError(
      501,
      'RESELLER_SCHEMA_PENDING',
      'backend_unavailable',
      'Reseller profile endpoint mapping requires confirmed API schema.',
      'provide_reseller_docs',
    );
  }

  async getPurchasedServices(_customerId: string): Promise<ResellerPurchasedService[]> {
    throw new GatewayError(
      501,
      'RESELLER_SCHEMA_PENDING',
      'backend_unavailable',
      'Reseller purchased services endpoint mapping requires confirmed API schema.',
      'provide_reseller_docs',
    );
  }

  async requestPasswordRecovery(_username: string): Promise<{ delegated: boolean; workflowMessage: string }> {
    throw new GatewayError(
      501,
      'RESELLER_SCHEMA_PENDING',
      'backend_unavailable',
      'Reseller password recovery mapping requires confirmed API schema.',
      'provide_reseller_docs',
    );
  }

  async verifyHealth(): Promise<{ ok: boolean; status: IntegrationConnectionState; message: string }> {
    return {
      ok: false,
      status: 'CONNECTED',
      message: 'Reseller base URL configured; awaiting verified Reseller API schema mapping.',
    };
  }
}

export function loadResellerAdapterFromEnv(): ResellerAdapter {
  const baseUrl = process.env.RESELLER_BASE_URL?.trim();
  const apiKey = process.env.RESELLER_API_KEY?.trim();

  if (baseUrl && apiKey) {
    return new HttpResellerAdapter(baseUrl, apiKey);
  }

  return new NotConnectedResellerAdapter();
}
