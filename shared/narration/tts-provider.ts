// Implemented on the server only.
import type { VoiceId } from './options';

export const TTS_PROVIDER_NAMES = ['elevenlabs', 'openai', 'none'] as const;
export type TtsProviderName = (typeof TTS_PROVIDER_NAMES)[number];

/** A voice the user can pick in Settings. */
export interface VoiceOption {
  id: VoiceId;
  /** Human-readable name, e.g. "Warm male". */
  label: string;
}

export interface SynthesizedAudio {
  /** MIME type, e.g. "audio/mpeg". */
  contentType: string;
  data: Uint8Array;
}

export interface TTSProvider {
  readonly name: TtsProviderName;
  /** Voices this provider offers; empty for "none" (the device voice is used). */
  readonly voices: readonly VoiceOption[];
  /** Returns null when the provider is "none": the app speaks the text on-device. */
  synthesize(text: string, voice: VoiceId, signal?: AbortSignal): Promise<SynthesizedAudio | null>;
}
