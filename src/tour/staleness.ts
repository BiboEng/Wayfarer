/** Whether a driving story arrived too late to tell. Pure: no React or Expo imports. */
import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

import { sideOfPlace } from './bearing';
import type { ModeProfile } from './mode-profile';

/** A driving story whose place is farther than this many radii is dropped. */
export const STALE_RADIUS_FACTOR = 1.5;

/** Driving only: the place is now behind, or more than 1.5x the radius away. Walking stories never go stale. */
export function isStaleStory(position: LatLng, headingDeg: number | null, place: LatLng, profile: ModeProfile): boolean {
  if (!profile.aheadOnly) return false;
  if (distanceMeters(position, place) > profile.radiusM * STALE_RADIUS_FACTOR) return true;
  return headingDeg !== null && sideOfPlace(position, headingDeg, place) === 'behind';
}
