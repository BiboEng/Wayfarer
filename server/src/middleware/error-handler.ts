import type { ErrorRequestHandler } from 'express';
import type { ErrorCode } from '@shared/api/errors';
import { sendApiError } from '../http/api-error';

interface HttpLikeError {
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
}

/** Pure: maps any thrown value to a status, code and client-safe message. */
export function classifyError(err: unknown): { status: number; code: ErrorCode; message: string } {
  const e: HttpLikeError = typeof err === 'object' && err !== null ? err : {};
  const raw = typeof e.status === 'number' ? e.status : e.statusCode;
  const status = typeof raw === 'number' && raw >= 400 && raw < 500 ? raw : undefined;

  // Matched by name so this file does not depend on the landmarks module.
  if (err instanceof Error && err.name === 'LandmarkUpstreamError') {
    return { status: 502, code: 'UPSTREAM_FAILED', message: 'Landmark data is temporarily unavailable.' };
  }

  if (status !== undefined) {
    const message = e.type === 'entity.parse.failed' ? 'Malformed JSON body.' : 'Bad request.';
    return { status, code: 'BAD_REQUEST', message };
  }
  return { status: 500, code: 'INTERNAL', message: 'Something went wrong on the server.' };
}

// Express recognises error handlers by their four parameters.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, code, message } = classifyError(err);
  // Log only the route, status and error kind: never err.message (it can quote the request body), headers or stacks.
  const kind = typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string' ? err.type : err instanceof Error ? err.name : 'non-error';
  console.error(`[error] ${req.method} ${req.path} -> ${status} ${code} (${kind})`);
  sendApiError(res, status, code, message);
};
