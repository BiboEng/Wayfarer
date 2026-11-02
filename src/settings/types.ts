import type { NarrationLength, TravelMode, VoiceId } from '@shared/narration/options';

/** What the user picks on the Settings screen. Used by Live Tour and Explore. */
export interface TourSettings {
  /** null = the server's default voice (or the phone voice when the server has none). */
  voice: VoiceId | null;
  length: NarrationLength;
  /** 'auto' lets Live Tour detect walking or driving from speed. */
  travelMode: 'auto' | TravelMode;
}

export const DEFAULT_SETTINGS: TourSettings = { voice: null, length: 'medium', travelMode: 'auto' };

export interface SettingsStore {
  /** The current settings (defaults until the saved ones have loaded). */
  get(): TourSettings;
  /** Merges and saves. Saving failures are ignored: the new values still apply for this session. */
  set(patch: Partial<TourSettings>): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}
