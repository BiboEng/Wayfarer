import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { APP_TOKEN_HEADER } from '@shared/api/endpoints';
import { sendApiError } from '../http/api-error';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Constant-time comparison. Hashing first makes both buffers equal length. */
export function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Rejects requests without the correct app token header. A speed bump, not real auth. */
export function appTokenMiddleware(expectedToken: string): RequestHandler {
  return (req, res, next) => {
    if (tokensMatch(req.get(APP_TOKEN_HEADER), expectedToken)) {
      next();
      return;
    }
    sendApiError(res, 401, 'UNAUTHORIZED', 'Missing or invalid app token.');
  };
}
