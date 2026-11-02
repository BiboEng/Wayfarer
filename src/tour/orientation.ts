/** The "Coming up on your left" side for a story. Pure: no React or Expo imports. */
import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

import { sideOfPlace } from './bearing';
import type { Side } from './types';

/** Closer than this, "coming up" makes no sense: the place is already here. */
export const ORIENTATION_MIN_DISTANCE_M = 40;

/** The side to announce, or null (no heading, too close, or behind). */
export function orientationSide(position: LatLng | null, headingDeg: number | null, place: LatLng): Side | null {
  if (!position || headingDeg === null) return null;
  if (distanceMeters(position, place) <= ORIENTATION_MIN_DISTANCE_M) return null;
  const side = sideOfPlace(position, headingDeg, place);
  return side === 'behind' ? null : side;
}
