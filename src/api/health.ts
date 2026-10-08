import { ENDPOINTS } from '@shared/api/endpoints';
import type { HealthResponse } from '@shared/api/health';

import type { ApiResult } from './client';
import { apiClient } from './instance';

export function getHealth(): Promise<ApiResult<HealthResponse>> {
  return apiClient.get<HealthResponse>(ENDPOINTS.health);
}
