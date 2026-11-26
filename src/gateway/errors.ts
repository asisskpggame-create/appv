import crypto from 'node:crypto';
import type { ErrorCategory, GatewayErrorEnvelope } from './types.ts';

export function generateDiagnosticId(): string {
  return `diag_${crypto.randomBytes(6).toString('hex')}`;
}

export class GatewayError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly diagnosticId: string;
  public readonly recoveryAction?: string;

  constructor(
    statusCode: number,
    code: string,
    category: ErrorCategory,
    message: string,
    recoveryAction?: string,
  ) {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode;
    this.code = code;
    this.category = category;
    this.diagnosticId = generateDiagnosticId();
    this.recoveryAction = recoveryAction;
  }

  toEnvelope(): GatewayErrorEnvelope {
    return {
      error: {
        code: this.code,
        category: this.category,
        message: this.message,
        diagnosticId: this.diagnosticId,
        ...(this.recoveryAction ? { recoveryAction: this.recoveryAction } : {}),
      },
    };
  }
}
