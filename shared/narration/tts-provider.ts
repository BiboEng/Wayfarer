// DRAFT: finalized by the Lead in Phase 3. Implemented on the server only.
import type { VoiceId } from './options';

export const TTS_PROVIDER_NAMES = ['elevenlabs', 'openai', 'none'] as const;
export type TtsProviderName = (typeof TTS_PROVIDER_NAMES)[number];

export interface SynthesizedAudio {
  /** MIME type, e.g. "audio/mpeg". */
  contentType: string;
  data: Uint8Array;
}

export interface TTSProvider {
  readonly name: TtsProviderName;
  /** Returns null when the provider is "none": the app speaks the text on-device. */
  synthesize(text: string, voice: VoiceId, signal?: AbortSignal): Promise<SynthesizedAudio | null>;
}
