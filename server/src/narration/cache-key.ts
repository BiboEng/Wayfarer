import { createHash } from 'node:crypto';
import type { OrientationCue } from '@shared/narration/cues';
import type { TtsProviderName } from '@shared/narration/tts-provider';
import type { NarrationLength, TravelMode, VoiceId } from '@shared/narration/options';
import { PROMPT_VERSION } from './prompt';

export interface NarrationKeyParts {
  landmarkId: string;
  travelMode: TravelMode;
  length: NarrationLength;
}

/** Pure: cache key of the story text. No voice: one text serves every voice. Includes the prompt version, so a better prompt starts fresh. */
export function narrationCacheKey(parts: NarrationKeyParts): string {
  return `narration:p${PROMPT_VERSION}:${parts.landmarkId}:${parts.travelMode}:${parts.length}`;
}

/** Pure: opaque 64-hex key of the audio of one text in one voice (safe to put in a URL or file name). */
export function audioBlobKey(text: string, voice: VoiceId): string {
  return createHash('sha256').update(`${voice}
${text}`).digest('hex');
}

/** Pure: opaque 64-hex key of the audio of one orientation cue, in one voice of one TTS provider. */
export function cueAudioKey(cue: OrientationCue, provider: TtsProviderName, voice: VoiceId, text: string): string {
  return createHash('sha256').update(`cue|${provider}|${voice}|${text}`).digest('hex');
}
