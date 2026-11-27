import type {
  AuthClient,
  AuthError,
  AuthSession,
  AuthTokens,
  DeviceInfo,
  LoginCredentials,
} from './types';

export class AuthClientError extends Error {
  public readonly authError: AuthError;

  constructor(authError: AuthError) {
    super(authError.message);
    this.name = 'AuthClientError';
    this.authError = authError;
  }
}

export function createDiagnosticId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `diag_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `diag_${Date.now().toString(36)}`;
}

interface GatewayErrorEnvelope {
  error?: {
    code?: string;
    category?: AuthError['category'];
    message?: string;
    diagnosticId?: string;
    recoveryAction?: AuthError['recoveryAction'];
  };
}

function mapHttpStatusToError(status: number, body?: GatewayErrorEnvelope): AuthError {
  if (body?.error?.code && body.error.message) {
    return {
      code: body.error.code,
      category: body.error.category ?? 'authentication_failure',
      message: body.error.message,
      diagnosticId: body.error.diagnosticId ?? createDiagnosticId(),
      recoveryAction: body.error.recoveryAction,
    };
  }

  if (status === 401) {
    return {
      code: 'AUTH_INVALID_CREDENTIALS',
      category: 'authentication_failure',
      message: 'Invalid username or password.',
      diagnosticId: createDiagnosticId(),
      recoveryAction: 'verify_credentials',
    };
  }
  if (status === 403) {
    return {
      code: 'AUTH_ACCOUNT_SUSPENDED',
      category: 'account_suspended',
      message: 'Account is suspended or disabled.',
      diagnosticId: createDiagnosticId(),
      recoveryAction: 'contact_support',
    };
  }
  if (status === 404 || status === 501 || status === 502 || status === 503) {
    return {
      code: 'GATEWAY_NOT_CONNECTED',
      category: 'backend_unavailable',
      message: 'Authentication gateway endpoint is not yet connected.',
      diagnosticId: createDiagnosticId(),
      recoveryAction: 'configure_gateway',
    };
  }

  return {
    code: `HTTP_${status}`,
    category: 'backend_unavailable',
    message: 'Unexpected response from authentication service.',
    diagnosticId: createDiagnosticId(),
    recoveryAction: 'retry_request',
  };
}

export class HttpAuthClient implements AuthClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async login(credentials: LoginCredentials, device: DeviceInfo): Promise<AuthSession> {
    return this.postSession('/auth/login', {
      username: credentials.username.trim(),
      password: credentials.password,
      device,
    });
  }

  async loginWithLink(link: string, device: DeviceInfo): Promise<AuthSession> {
    return this.postSession('/auth/login-link', { link: link.trim(), device });
  }

  private async postSession(path: string, requestBody: Record<string, unknown>): Promise<AuthSession> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch {
      throw new AuthClientError({
        code: 'NETWORK_UNREACHABLE',
        category: 'network_error',
        message: 'Unable to reach authentication gateway.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'retry_request',
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // Vite dev server returns HTML for unmounted /api/* routes prior to Phase 3.
      throw new AuthClientError({
        code: 'GATEWAY_NOT_CONNECTED',
        category: 'backend_unavailable',
        message: 'Authentication gateway is not connected in this phase.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'configure_gateway',
      });
    }

    const payload = (await response.json().catch(() => ({}))) as GatewayErrorEnvelope & Partial<AuthSession>;
    if (!response.ok) {
      throw new AuthClientError(mapHttpStatusToError(response.status, payload));
    }

    if (!payload.user || !payload.tokens?.accessToken) {
      throw new AuthClientError({
        code: 'AUTH_MALFORMED_RESPONSE',
        category: 'backend_unavailable',
        message: 'Authentication response missing verified session payload.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'retry_request',
      });
    }

    return payload as AuthSession;
  }

  async refresh(refreshToken: string, deviceId: string): Promise<AuthTokens> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refreshToken, deviceId }),
      });
    } catch {
      throw new AuthClientError({
        code: 'NETWORK_UNREACHABLE',
        category: 'network_error',
        message: 'Unable to reach refresh endpoint.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'retry_request',
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new AuthClientError({
        code: 'GATEWAY_NOT_CONNECTED',
        category: 'backend_unavailable',
        message: 'Refresh endpoint is not connected yet.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'configure_gateway',
      });
    }

    const payload = (await response.json().catch(() => ({}))) as GatewayErrorEnvelope & {
      tokens?: AuthTokens;
    };

    if (!response.ok || !payload.tokens?.accessToken) {
      throw new AuthClientError(
        response.status === 401
          ? {
              code: 'AUTH_SESSION_EXPIRED',
              category: 'session_expired',
              message: 'Refresh token expired or revoked.',
              diagnosticId: createDiagnosticId(),
              recoveryAction: 'reauthenticate',
            }
          : mapHttpStatusToError(response.status, payload),
      );
    }

    return payload.tokens;
  }

  async logout(accessToken: string, deviceId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ deviceId }),
      });
    } catch {
      // Local memory clearance still proceeds even if network logout fails.
    }
  }

  async requestPasswordRecovery(
    username: string,
  ): Promise<{ delegated: boolean; workflowMessage: string }> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/auth/password-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      });
    } catch {
      throw new AuthClientError({
        code: 'NETWORK_UNREACHABLE',
        category: 'network_error',
        message: 'Unable to reach password recovery endpoint.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'retry_request',
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new AuthClientError({
        code: 'GATEWAY_NOT_CONNECTED',
        category: 'backend_unavailable',
        message: 'Password recovery workflow is not connected yet.',
        diagnosticId: createDiagnosticId(),
        recoveryAction: 'configure_gateway',
      });
    }

    const payload = (await response.json().catch(() => ({}))) as GatewayErrorEnvelope & {
      delegated?: boolean;
      workflowMessage?: string;
    };

    if (!response.ok) {
      throw new AuthClientError(mapHttpStatusToError(response.status, payload));
    }

    return {
      delegated: Boolean(payload.delegated),
      workflowMessage: payload.workflowMessage ?? 'Recovery request submitted.',
    };
  }
}
