import type { CueQuery, CueResponse } from '@shared/api/cues';
import { ENDPOINTS } from '@shared/api/endpoints';
import type { OrientationCue } from '@shared/narration/cues';
import type { VoiceId } from '@shared/narration/options';

import type { ApiResult } from './client';
import { apiClient } from './instance';
import { withQuery } from './query-string';

/** The first request for a voice makes the audio, so allow a little longer than the default. */
const CUE_TIMEOUT_MS = 20_000;

/** A fixed orientation line ("Coming up on your left.") in the given voice (omit for the default). */
export function getCue(cue: OrientationCue, voice?: VoiceId | null): Promise<ApiResult<CueResponse>> {
  const query: CueQuery = voice ? { voice } : {};
  return apiClient.get<CueResponse>(withQuery(`${ENDPOINTS.cues}/${cue}`, { ...query }), {
    timeoutMs: CUE_TIMEOUT_MS,
  });
}
