import type { TTSProvider } from '@shared/narration/tts-provider';
import type { ServerConfig } from '../config/env';
import { createElevenLabsProvider } from './elevenlabs-provider';
import { createNoneProvider } from './none-provider';

/** Picks the provider named by TTS_PROVIDER. ("openai" arrives in Phase 7.) */
export function createTtsProvider(config: Pick<ServerConfig, 'ttsProvider' | 'elevenLabs'>): TTSProvider {
  if (config.ttsProvider === 'elevenlabs' && config.elevenLabs) {
    return createElevenLabsProvider({ apiKey: config.elevenLabs.apiKey, voices: config.elevenLabs.voices });
  }
  return createNoneProvider();
}
