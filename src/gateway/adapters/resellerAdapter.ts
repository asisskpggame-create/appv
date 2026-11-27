import crypto from 'node:crypto';
import { GatewayError } from '../errors.ts';
import type {
  IntegrationConnectionState,
  ResellerCustomerRecord,
  ResellerPurchasedService,
} from '../types.ts';

const RESELLER_TIMEOUT_MS = 8_000;
const RESELLER_MAX_BYTES = 256 * 1024;

function resellerUnavailable(message: string): GatewayError {
  return new GatewayError(502, 'RESELLER_UPSTREAM_UNAVAILABLE', 'backend_unavailable', message, 'retry_later');
}

/** HMAC-SHA256 hex over `${timestamp}.${body}`; the receiver recomputes it and rejects old timestamps. */
export function signResellerRequest(apiKey: string, timestamp: string, body: string): string {
  return crypto.createHmac('sha256', apiKey).update(`${timestamp}.${body}`).digest('hex');
}

/** Maps the `/verify-login` JSON into a customer record; refuses answers it cannot trust. */
export function mapVerifyLoginResponse(raw: unknown): ResellerCustomerRecord {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (o.ok === false) {
    throw new GatewayError(
      401,
      'AUTH_INVALID_CREDENTIALS',
      'authentication_failure',
      'Invalid username or password.',
      'verify_credentials',
    );
  }
  const username = typeof o.username === 'string' ? o.username.trim() : '';
  const subscriptionUrl = typeof o.subscription_url === 'string' ? o.subscription_url.trim() : '';
  if (o.ok !== true || !username || !subscriptionUrl) {
    throw resellerUnavailable('The account service answered in an unexpected format.');
  }
  const customerId =
    typeof o.customer_id === 'string' || typeof o.customer_id === 'number' ? String(o.customer_id) : username;
  const devices = typeof o.allowed_devices === 'number' && o.allowed_devices > 0 ? Math.floor(o.allowed_devices) : null;
  return {
    customerId,
    username,
    status: o.status === 'suspended' ? 'suspended' : 'active',
    allowedDevices: devices,
    ...(typeof o.renewal_url === 'string' && /^https:\/\//i.test(o.renewal_url) ? { renewalUrl: o.renewal_url } : {}),
    subscriptionUrl,
  };
}

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

  /**
   * Password login is verified by the reseller system (e.g. the sales bot), never by PasarGuard.
   * Contract (see RESELLER_INTEGRATION.md): POST {base}/verify-login, JSON {username, password},
   * signed with HMAC-SHA256 over `${timestamp}.${body}` using the shared key.
   */
  async authenticateEndUser(username: string, password: string): Promise<ResellerCustomerRecord> {
    if (!this.baseUrl || !this.apiKey) {
      throw new GatewayError(
        503,
        'RESELLER_NOT_CONNECTED',
        'backend_unavailable',
        'Reseller adapter credentials are missing.',
        'configure_reseller_adapter',
      );
    }

    // `nonce` makes every signed body unique, so a receiver that refuses a repeated signature (replay
    // protection) does not also refuse two real logins made in the same second.
    const body = JSON.stringify({ username, password, nonce: crypto.randomBytes(16).toString('hex') });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signResellerRequest(this.apiKey, timestamp, body);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/verify-login`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'ASiS-Gateway/0.4',
          'X-ASiS-Timestamp': timestamp,
          'X-ASiS-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(RESELLER_TIMEOUT_MS),
      });
    } catch {
      throw resellerUnavailable('The account service is unreachable.');
    }

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new GatewayError(
        401,
        'AUTH_INVALID_CREDENTIALS',
        'authentication_failure',
        'Invalid username or password.',
        'verify_credentials',
      );
    }
    if (res.status === 429) {
      throw new GatewayError(
        429,
        'AUTH_RATE_LIMITED',
        'rate_limited',
        'Too many attempts. Try again later.',
        'retry_later',
      );
    }
    if (!res.ok) throw resellerUnavailable(`The account service answered with HTTP ${res.status}.`);

    const text = await res.text();
    if (text.length > RESELLER_MAX_BYTES) throw resellerUnavailable('The account service response is too large.');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw resellerUnavailable('The account service response is not valid JSON.');
    }
    return mapVerifyLoginResponse(json);
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
