import type { RequestHandler } from 'express';
import { sendApiError } from '../http/api-error';

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendApiError(res, 404, 'NOT_FOUND', 'Route not found.');
};
