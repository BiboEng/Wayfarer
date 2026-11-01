import type { NarrationLength, TravelMode, VoiceId } from '../narration/options';
import type { VoiceOption } from '../narration/tts-provider';

/**
 * Body of POST /narrations. Only the landmark id is sent: the server reloads
 * the facts itself and never narrates text supplied by the app.
 */
export interface NarrationRequest {
  landmarkId: string;
  length: NarrationLength;
  travelMode: TravelMode;
  /** Omit for the server's default voice. */
  voice?: VoiceId;
}

/** Where the narration text came from. */
export const NARRATION_SOURCES = ['ai', 'wikipedia'] as const;
/** "ai": written by the model. "wikipedia": the article intro, used when the daily AI cap is reached or the model fails. */
export type NarrationSource = (typeof NARRATION_SOURCES)[number];

export interface NarrationAudio {
  /**
   * Path of GET /narrations/audio/:key, relative to the server URL. The request
   * needs the app token header, like every other call.
   */
  url: string;
  contentType: string;
}

/** Response of POST /narrations. */
export interface NarrationResponse {
  landmarkId: string;
  /** Plain text written for the ear: no markdown, no lists. */
  text: string;
  /**
   * null means "speak `text` on the device" (TTS provider "none", a daily cap
   * was reached, or TTS failed).
   */
  audio: NarrationAudio | null;
  source: NarrationSource;
}

/** Response of GET /voices. */
export interface VoicesResponse {
  /** Empty when the server has no TTS provider: the device voice is used. */
  voices: VoiceOption[];
  defaultVoice: VoiceId | null;
}
