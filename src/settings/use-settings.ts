import { useSyncExternalStore } from 'react';

import { settingsStore } from './settings-store';
import type { TourSettings } from './types';

/** The current settings; re-renders when they change. */
export function useSettings(): TourSettings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
}
