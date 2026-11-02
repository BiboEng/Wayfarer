import { useEffect } from 'react';
import { AppState } from 'react-native';

import { tourSession } from '@/tour';
import type { TourSource } from '@/tour/types';

/** Statuses that wait for the user to fix something outside the app (permission, location switch, precise location). */
const WAITING_STATUSES = ['needs-permission', 'permission-denied', 'location-off', 'location-approximate'];

/**
 * Ties the tour to the Live Tour screen: it starts on mount and stops on unmount. When the app
 * comes back to the foreground while the tour is waiting for a permission or the location
 * switch, it tries to start again, so returning from the phone's settings just works.
 */
export function useTourLifecycle(): { changeSource: (source: TourSource) => void } {
  useEffect(() => {
    tourSession.start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && WAITING_STATUSES.includes(tourSession.getSnapshot().status)) {
        tourSession.start(tourSession.getSnapshot().source);
      }
    });
    return () => {
      subscription.remove();
      tourSession.stop();
    };
  }, []);

  return {
    changeSource: (source) => {
      tourSession.stop();
      tourSession.start(source);
    },
  };
}
