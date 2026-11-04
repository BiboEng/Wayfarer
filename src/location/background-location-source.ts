/**
 * Real GPS that keeps going with the screen off: expo-location's location task with a foreground
 * service (its own notification). Needs only "While using the app" permission, but Android lets
 * it start only while the app is on screen; when off screen, start and setOptions are refused.
 */
import * as Location from 'expo-location';

import { toExpoAccuracy } from './expo-accuracy';
import { claimLocationTask, holdsLocationTask, LOCATION_TASK, releaseLocationTask } from './location-task';
import type { BackgroundLocationSource, TrackingOptions } from './types';

const SERVICE_NOTIFICATION: Location.LocationTaskServiceOptions = {
  notificationTitle: 'Wayfarer tour is running',
  notificationBody: 'Finding places near you',
  notificationColor: '#C1693C',
  // Swiping the app away from recents ends the tour and this notification with it.
  killServiceOnDestroy: true,
};

function taskOptions(options: TrackingOptions): Location.LocationTaskOptions {
  return {
    accuracy: toExpoAccuracy(options.accuracy),
    timeInterval: options.timeIntervalMs,
    distanceInterval: options.distanceIntervalM,
    // Hands-free: never pop up the "improve accuracy" system dialog mid-tour.
    mayShowUserSettingsDialog: false,
    foregroundService: SERVICE_NOTIFICATION,
  };
}

export function createBackgroundLocationSource(): BackgroundLocationSource {
  /** This source's claim on the shared task while it should run; null after stop(). */
  let claim: number | null = null;

  return {
    async start(options, onFix, onError) {
      const mine = claimLocationTask({ onFix, onError });
      claim = mine;
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, taskOptions(options));
      } catch (err) {
        if (claim === mine) claim = null;
        releaseLocationTask(mine);
        throw err;
      }
      // Stopped while starting: the late start must not keep running, unless a newer tour owns it now.
      if (claim !== mine) releaseLocationTask(mine);
    },
    async setOptions(options) {
      if (claim === null || !holdsLocationTask(claim)) return;
      // Same task again: expo-location restarts the updates with the new options.
      await Location.startLocationUpdatesAsync(LOCATION_TASK, taskOptions(options));
    },
    stop() {
      if (claim !== null) releaseLocationTask(claim);
      claim = null;
    },
  };
}
