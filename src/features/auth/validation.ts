import type { LoginCredentials } from './types.ts';

export interface AuthValidationMessages {
  validationUsernameRequired: string;
  validationUsernameMin: string;
  validationUsernameFormat: string;
  validationPasswordRequired: string;
  validationPasswordMin: string;
}

export interface AuthFieldErrors {
  username?: string;
  password?: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function validateCredentials(
  credentials: LoginCredentials,
  copy: AuthValidationMessages,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const trimmedUsername = credentials.username.trim();

  if (!trimmedUsername) {
    errors.username = copy.validationUsernameRequired;
  } else if (trimmedUsername.length < 3) {
    errors.username = copy.validationUsernameMin;
  } else if (!USERNAME_PATTERN.test(trimmedUsername)) {
    errors.username = copy.validationUsernameFormat;
  }

  if (!credentials.password) {
    errors.password = copy.validationPasswordRequired;
  } else if (credentials.password.length < 6) {
    errors.password = copy.validationPasswordMin;
  }

  return errors;
}
