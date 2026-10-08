import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendApiError } from '../http/api-error';

/** Per-IP limiter, 1-minute window, applied to every route. */
export function rateLimitMiddleware(limitPerMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      sendApiError(res, 429, 'RATE_LIMITED', 'Too many requests. Please slow down.');
    },
  });
}
