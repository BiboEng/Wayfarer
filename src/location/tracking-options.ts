/**
 * Location accuracy and update rate per travel mode. Pure: no React or Expo imports.
 * High accuracy is the lowest that still gives usable headings; the intervals are as sparse as
 * the re-check distances (60 m walking, 250 m driving) and the course rule (15 m moves) allow.
 */
import type { TravelMode } from '@shared/narration/options';

import type { TrackingOptions } from './types';

export const TRACKING_OPTIONS: Record<TravelMode, TrackingOptions> = {
  walking: { accuracy: 'high', distanceIntervalM: 10, timeIntervalMs: 3_000 },
  driving: { accuracy: 'high', distanceIntervalM: 30, timeIntervalMs: 5_000 },
};

export function trackingOptionsFor(mode: TravelMode): TrackingOptions {
  return TRACKING_OPTIONS[mode];
}

/**
 * The same options for the background location task, with no distance filter: a fix then
 * arrives every interval (walking 3 s, driving 5 s) even when standing still. Android freezes JS
 * timers while the app is off screen except while a task event runs, so these regular fixes are
 * what keep the tour's timeouts and retries (request abort, audio start, 60 s retry) going.
 */
export function backgroundTrackingOptions(options: TrackingOptions): TrackingOptions {
  return { ...options, distanceIntervalM: 0 };
}
