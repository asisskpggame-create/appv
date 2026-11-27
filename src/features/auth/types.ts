export type AuthErrorCategory =
  | 'validation_error'
  | 'authentication_failure'
  | 'account_suspended'
  | 'session_expired'
  | 'network_error'
  | 'backend_unavailable';

export interface AuthError {
  code: string;
  category: AuthErrorCategory;
  message: string;
  diagnosticId: string;
  recoveryAction?: 'verify_credentials' | 'contact_support' | 'reauthenticate' | 'retry_request' | 'configure_gateway';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: 'web' | 'android' | 'ios' | 'windows';
  appVersion: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix epoch ms
  tokenType: 'Bearer';
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  status: 'active' | 'suspended';
  activeDevicesCount?: number;
}

export interface AuthSession {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  deviceId: string;
  issuedAt: number;
}

export interface SessionStorageAdapter {
  readSession(): Promise<AuthSession | null>;
  writeSession(session: AuthSession): Promise<void>;
  clearSession(): Promise<void>;
}

export interface AuthClient {
  login(credentials: LoginCredentials, device: DeviceInfo): Promise<AuthSession>;
  /** Sign in with a PasarGuard subscription link (no password). */
  loginWithLink(link: string, device: DeviceInfo): Promise<AuthSession>;
  refresh(refreshToken: string, deviceId: string): Promise<AuthTokens>;
  logout(accessToken: string, deviceId: string): Promise<void>;
  requestPasswordRecovery(username: string): Promise<{ delegated: boolean; workflowMessage: string }>;
}
