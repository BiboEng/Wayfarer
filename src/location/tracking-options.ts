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
