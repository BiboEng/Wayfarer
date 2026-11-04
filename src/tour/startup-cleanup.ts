/** Wires the leftover cleanup to the real location task, notification and tour session. */
import * as Location from 'expo-location';

import { LOCATION_TASK, stopLocationTaskUpdates } from '@/location/location-task';

import { cleanUpLeftovers } from './leftover-cleanup';
import { dismissTourNotification } from './notification/tour-notification';
import { isRunningStatus } from './tour-snapshot';
import { tourSession } from './tour-session';

/** Call once when the app starts. Stops leftover location updates and removes a leftover tour notification. Never rejects. */
export function cleanUpTourLeftovers(): Promise<void> {
  return cleanUpLeftovers({
    isTourRunning: () => isRunningStatus(tourSession.getSnapshot().status),
    hasStartedUpdates: () => Location.hasStartedLocationUpdatesAsync(LOCATION_TASK),
    stopUpdates: stopLocationTaskUpdates,
    dismissNotification: dismissTourNotification,
  });
}
