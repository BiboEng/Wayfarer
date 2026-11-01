import type { TTSProvider } from '@shared/narration/tts-provider';

/** No server audio: the app speaks the text with the phone's own voice. */
export function createNoneProvider(): TTSProvider {
  return { name: 'none', voices: [], synthesize: () => Promise.resolve(null) };
}
