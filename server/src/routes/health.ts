import { Router } from 'express';
import type { HealthResponse } from '@shared/api/health';
import { ENDPOINTS } from '@shared/api/endpoints';
import { SERVER_VERSION } from '../config/version';

export const healthRouter = Router();

healthRouter.get(ENDPOINTS.health, (_req, res) => {
  const body: HealthResponse = { status: 'ok', version: SERVER_VERSION };
  res.json(body);
});
