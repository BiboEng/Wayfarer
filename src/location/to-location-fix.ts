/** Converts an expo-location position to our LocationFix. Pure (type-only import). */
import type { LocationObject } from 'expo-location';

import type { LocationFix } from './types';

export function toLocationFix({ coords, timestamp }: LocationObject): LocationFix {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracyM: coords.accuracy ?? Infinity,
    // Android reports -1 / 0 when it doesn't know; negative values are never real.
    speedMps: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
    headingDeg: coords.heading !== null && coords.heading >= 0 ? coords.heading : null,
    timestamp,
  };
}
