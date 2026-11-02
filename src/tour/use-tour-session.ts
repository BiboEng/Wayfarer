import { useSyncExternalStore } from 'react';

import { tourSession } from './tour-session';
import type { TourSnapshot } from './types';

/** The Live Tour state; re-renders when what the screen shows changes. */
export function useTourSession(): TourSnapshot {
  return useSyncExternalStore(tourSession.subscribe, tourSession.getSnapshot);
}
