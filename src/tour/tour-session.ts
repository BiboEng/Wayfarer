/** The app-wide Live Tour session, wired to real GPS (or a dev route), the server and the player. */
import { getCue } from '@/api/cues';
import { getNearbyLandmarks } from '@/api/landmarks';
import { requestNarration } from '@/api/narration';
import { narrationAudioSource } from '@/api/narration-audio';
import { narrationPlayer } from '@/audio';
import { simRouteFor } from '@/dev/routes';
import { createSimulatedLocationSource } from '@/dev/simulated-location-source';
import { createBackgroundLocationSource } from '@/location/background-location-source';
import { createExpoLocationSource } from '@/location/expo-location-source';
import { createGpsLocationSource } from '@/location/gps-location-source';
import { getLocationPermission, locationServicesEnabled, requestLocationPermission } from '@/location/permissions';
import { whenAppForeground } from '@/location/when-foreground';
import { settingsStore } from '@/settings';

import { createTourSession } from './create-tour-session';
import { tourLog } from './dev-log';
import { notificationChoice } from './notification/notification-choice';
import { getNotificationPermission, requestNotificationPermission } from './notification/notification-permission';
import type { TourSource } from './types';
import { asyncStorageVisitedStore } from './visited-storage';

/** Simulated routes exist only in dev builds; release builds always use real GPS. */
const isSimulated = (source: TourSource): boolean => __DEV__ && simRouteFor(source) !== null;

export const tourSession = createTourSession({
  isSimulated,
  createLocationSource(source, onBackgroundKnown) {
    const route = isSimulated(source) ? simRouteFor(source) : null;
    if (route) return createSimulatedLocationSource(route);
    return createGpsLocationSource({
      background: createBackgroundLocationSource(),
      createWatch: createExpoLocationSource,
      whenForeground: whenAppForeground,
      onBackgroundKnown,
    });
  },
  getPermission: getLocationPermission,
  requestPermission: requestLocationPermission,
  servicesEnabled: locationServicesEnabled,
  notifications: {
    getPermission: getNotificationPermission,
    request: requestNotificationPermission,
    wasDeclined: notificationChoice.wasDeclined,
    rememberDeclined: notificationChoice.rememberDeclined,
  },
  api: { getNearbyLandmarks, requestNarration, getCue },
  audioSource: narrationAudioSource,
  player: narrationPlayer,
  allowBackgroundAudio: (allowed) => narrationPlayer.setBackgroundAllowed(allowed),
  visitedStore: asyncStorageVisitedStore,
  getSettings: () => settingsStore.get(),
  subscribeSettings: (listener) => settingsStore.subscribe(listener),
  log: tourLog,
});
