/**
 * The three orientation lines ("Coming up on your left.") per voice, kept in memory for the app's
 * lifetime (the text is fixed, so they never go out of date).
 * Never waits: a line that isn't cached yet is fetched in the background, and this story gets the
 * text only (the device voice speaks it; with server audio the player skips it).
 * No React or Expo imports: the request and audio-source functions are injected.
 */
import type { CueResponse } from '@shared/api/cues';
import type { NarrationAudio } from '@shared/api/narration';
import { ORIENTATION_CUE_TEXT, ORIENTATION_CUES } from '@shared/narration/cues';
import type { VoiceId } from '@shared/narration/options';

import type { ApiResult } from '@/api/client';
import type { NarrationIntro, RemoteSound } from '@/audio/types';

import type { Side } from './types';

export interface CueCacheDeps {
  getCue(cue: Side, voice?: VoiceId | null): Promise<ApiResult<CueResponse>>;
  audioSource(audio: NarrationAudio): RemoteSound | null;
}

export interface CueCache {
  /** The intro for this side and voice: cached audio if available, otherwise text only. */
  introFor(side: Side, voice: VoiceId | null): NarrationIntro;
  /** Fetches the three lines for a voice in the background. */
  warm(voice: VoiceId | null): void;
  /** Ignores requests still on their way (the tour stopped); cached lines are kept. */
  cancelPending(): void;
}

export function createCueCache(deps: CueCacheDeps): CueCache {
  let generation = 0;
  const cached = new Map<string, NarrationIntro>();
  const inFlight = new Set<string>();
  const keyOf = (side: Side, voice: VoiceId | null) => `${voice ?? ''}|${side}`;

  function fetch(side: Side, voice: VoiceId | null): void {
    const key = keyOf(side, voice);
    if (cached.has(key) || inFlight.has(key)) return;
    inFlight.add(key);
    const current = generation;
    const done = (result: ApiResult<CueResponse> | null) => {
      if (current !== generation) return;
      inFlight.delete(key);
      // Failures aren't cached: the next story asks again.
      if (!result?.ok) return;
      const { text, audio } = result.data;
      cached.set(key, { text, audio: audio ? deps.audioSource(audio) : null });
    };
    deps.getCue(side, voice).then(done, () => done(null));
  }

  return {
    introFor(side, voice) {
      const hit = cached.get(keyOf(side, voice));
      if (hit) return hit;
      fetch(side, voice);
      return { text: ORIENTATION_CUE_TEXT[side], audio: null };
    },
    warm(voice) {
      ORIENTATION_CUES.forEach((side) => fetch(side, voice));
    },
    cancelPending() {
      generation += 1;
      inFlight.clear();
    },
  };
}
