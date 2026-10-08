import type { Response } from 'express';
import type { ApiError, ErrorCode } from '@shared/api/errors';

export function apiError(code: ErrorCode, message: string): ApiError {
  return { error: { code, message } };
}

export function sendApiError(res: Response, status: number, code: ErrorCode, message: string): void {
  res.status(status).json(apiError(code, message));
}
