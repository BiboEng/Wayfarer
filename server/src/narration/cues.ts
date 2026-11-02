import { ENDPOINTS } from '@shared/api/endpoints';
import type { CueResponse } from '@shared/api/cues';
import { ORIENTATION_CUE_TEXT, type OrientationCue } from '@shared/narration/cues';
import type { VoiceId } from '@shared/narration/options';
import type { TTSProvider } from '@shared/narration/tts-provider';
import { AUDIO_CONTENT_TYPE, type BlobStore } from '../cache/blob-store';
import type { DailyCaps } from '../costs/daily-caps';
import { createAudioMaker } from './audio-maker';
import { cueAudioKey } from './cache-key';

export interface CueServiceDeps {
  blobs: BlobStore;
  tts: TTSProvider;
  caps: DailyCaps;
  log?: (message: string) => void;
}

export interface CueService {
  /** Fixed line plus its audio in the given voice (made once, then served from the audio store). */
  getCue(cue: OrientationCue, voice?: VoiceId): Promise<CueResponse>;
}

/** Orientation cues: three short fixed lines per voice, so TTS is paid once per cue + provider + voice. */
export function createCueService(deps: CueServiceDeps): CueService {
  const log = deps.log ?? ((message: string) => console.log(message));
  const audio = createAudioMaker({ blobs: deps.blobs, tts: deps.tts, caps: deps.caps, log });

  return {
    async getCue(cue, requestedVoice) {
      const text = ORIENTATION_CUE_TEXT[cue];
      if (!audio.hasVoices) return { cue, text, audio: null };
      const voice = audio.resolveVoice(requestedVoice);
      const blobKey = cueAudioKey(cue, deps.tts.name, voice, text);
      // `ensure` checks the store first and shares one synthesis between simultaneous requests.
      let ok = false;
      try {
        ok = await audio.ensure(blobKey, text, voice);
      } catch {
        // A store failure must not break the tour: the app speaks the line on the device. Nothing from the error is logged.
        log('[cues] Audio store or cap failed; returning text only.');
      }
      return {
        cue,
        text,
        audio: ok ? { url: `${ENDPOINTS.narrationAudio}/${blobKey}`, contentType: AUDIO_CONTENT_TYPE } : null,
      };
    },
  };
}
