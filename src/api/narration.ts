import { ENDPOINTS } from '@shared/api/endpoints';
import type { NarrationRequest, NarrationResponse, VoicesResponse } from '@shared/api/narration';

import type { ApiResult } from './client';
import { apiClient } from './instance';

/** Writing the story (and its audio) can take a while on a cache miss. */
const NARRATION_TIMEOUT_MS = 45_000;

/** Asks the server to narrate a landmark it found earlier. */
export function requestNarration(request: NarrationRequest): Promise<ApiResult<NarrationResponse>> {
  return apiClient.post<NarrationResponse>(ENDPOINTS.narrations, request, { timeoutMs: NARRATION_TIMEOUT_MS });
}

/** Voices the server's TTS provider offers (empty: use the device voice). */
export function getVoices(): Promise<ApiResult<VoicesResponse>> {
  return apiClient.get<VoicesResponse>(ENDPOINTS.voices);
}
