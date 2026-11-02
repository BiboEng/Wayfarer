import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseSettings } from './parse-settings';
import type { TourSettings } from './types';

export const SETTINGS_STORAGE_KEY = 'wayfarer.settings.v1';

/** Reads the saved settings. Never throws: a failed read gives the defaults. */
export async function loadSettings(): Promise<TourSettings> {
  try {
    return parseSettings(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    return parseSettings(null);
  }
}

/** Saves the settings. Failures are ignored: the values still apply for this session. */
export async function saveSettings(settings: TourSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Nothing useful to do; the user is not interrupted.
  }
}
