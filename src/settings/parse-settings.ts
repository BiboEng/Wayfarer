import { NARRATION_LENGTHS, TRAVEL_MODES } from '@shared/narration/options';

import { DEFAULT_SETTINGS, type TourSettings } from './types';

/** Longest voice id we accept from storage; anything bigger is corrupt. */
const MAX_VOICE_ID_LENGTH = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

/**
 * Turns saved JSON text into settings. Missing, unknown or corrupt input falls back to
 * `DEFAULT_SETTINGS`, field by field, so one bad value never resets the others.
 */
export function parseSettings(raw: string | null | undefined): TourSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!isRecord(data)) return { ...DEFAULT_SETTINGS };

  const { voice, length, travelMode } = data;
  return {
    voice:
      typeof voice === 'string' && voice.length > 0 && voice.length <= MAX_VOICE_ID_LENGTH
        ? voice
        : DEFAULT_SETTINGS.voice,
    length: isOneOf(NARRATION_LENGTHS, length) ? length : DEFAULT_SETTINGS.length,
    travelMode:
      travelMode === 'auto' || isOneOf(TRAVEL_MODES, travelMode) ? travelMode : DEFAULT_SETTINGS.travelMode,
  };
}
