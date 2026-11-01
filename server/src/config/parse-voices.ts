import type { VoiceOption } from '@shared/narration/tts-provider';

const VOICE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Pure: parses "Label:voiceId,Label:voiceId". The first voice is the default.
 * Returns null if the text is malformed or empty.
 */
export function parseVoices(text: string): VoiceOption[] | null {
  const voices: VoiceOption[] = [];
  for (const part of text.split(',')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const colon = trimmed.lastIndexOf(':');
    if (colon < 1) return null;
    const label = trimmed.slice(0, colon).trim();
    const id = trimmed.slice(colon + 1).trim();
    if (label === '' || !VOICE_ID.test(id)) return null;
    voices.push({ id, label });
  }
  return voices.length > 0 ? voices : null;
}
