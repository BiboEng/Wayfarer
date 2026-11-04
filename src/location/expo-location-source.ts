/**
 * Real GPS through expo-location's watchPositionAsync. Foreground only: Android pauses the watch
 * while the app is off screen. The tour uses it only when the background task can't start.
 */
import * as Location from 'expo-location';

import { toExpoAccuracy } from './expo-accuracy';
import { toLocationFix } from './to-location-fix';
import type { FixListener, LocationErrorListener, LocationSource, TrackingOptions } from './types';

export function createExpoLocationSource(): LocationSource {
  /** Bumped on every (re)start and stop; a watch that resolves late with an old id is removed. */
  let watchId = 0;
  let subscription: Location.LocationSubscription | null = null;
  let listeners: { onFix: FixListener; onError?: LocationErrorListener } | null = null;

  function removeWatch(): void {
    watchId += 1;
    const current = subscription;
    subscription = null;
    try {
      current?.remove();
    } catch (err) {
      listeners?.onError?.(`could not remove the location watch: ${String(err)}`);
    }
  }

  function watch(options: TrackingOptions): void {
    removeWatch();
    const id = watchId;
    const report = (message: string) => {
      if (id === watchId) listeners?.onError?.(message);
    };
    Location.watchPositionAsync(
      {
        accuracy: toExpoAccuracy(options.accuracy),
        distanceInterval: options.distanceIntervalM,
        timeInterval: options.timeIntervalMs,
        // Hands-free: never pop up the "improve accuracy" system dialog mid-tour.
        mayShowUserSettingsDialog: false,
      },
      (location) => {
        if (id === watchId) listeners?.onFix(toLocationFix(location));
      },
      report,
    )
      .then((sub) => {
        if (id === watchId) subscription = sub;
        else sub.remove();
      })
      .catch((err: unknown) => report(`could not watch the location: ${String(err)}`));
  }

  return {
    start(options, onFix, onError) {
      listeners = { onFix, onError };
      watch(options);
    },
    setOptions(options) {
      if (listeners) watch(options);
    },
    stop() {
      removeWatch();
      listeners = null;
    },
  };
}
