import type { OrientationCue } from '../narration/cues';
import type { VoiceId } from '../narration/options';
import type { NarrationAudio } from './narration';

/** Query of GET `${ENDPOINTS.cues}/:cue`. Omit `voice` for the server's default voice. */
export interface CueQuery {
  voice?: VoiceId;
}

/** Response of GET `${ENDPOINTS.cues}/:cue`. */
export interface CueResponse {
  cue: OrientationCue;
  /** The line itself (`ORIENTATION_CUE_TEXT[cue]`), for the device voice. */
  text: string;
  /**
   * null means "speak `text` on the device" (TTS provider "none", the daily TTS
   * cap was reached, or TTS failed). Served by `ENDPOINTS.narrationAudio`.
   */
  audio: NarrationAudio | null;
}
