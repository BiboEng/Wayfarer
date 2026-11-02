/** Bearings and left/right/ahead/behind. Pure: no React or Expo imports. */
import type { LatLng } from '@shared/geo/lat-lng';

import type { Side } from './types';

/** Within ±30° of the direction of travel counts as ahead. */
export const AHEAD_HALF_ANGLE_DEG = 30;
/** Beyond ±150° counts as behind; in between is left or right. */
export const BEHIND_FROM_DEG = 150;

export type RelativeSide = Side | 'behind';

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const toDegrees = (rad: number) => (rad * 180) / Math.PI;

/** Normalizes any angle to 0 ≤ a < 360. */
export function normalizeDeg(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

/** Initial great-circle bearing from `from` to `to`, 0 ≤ b < 360 (0 = north, 90 = east). */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeDeg(toDegrees(Math.atan2(y, x)));
}

/** Mean Earth radius in meters, as in `shared/geo/distance.ts`. */
const EARTH_RADIUS_M = 6_371_008.8;

/** The point `meters` away from `from` along the initial bearing `bearing` (great circle). */
export function destinationPoint(from: LatLng, bearing: number, meters: number): LatLng {
  const angular = meters / EARTH_RADIUS_M;
  const theta = toRadians(bearing);
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta));
  const lng2 =
    lng1 + Math.atan2(Math.sin(theta) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDegrees(lat2), lng: ((toDegrees(lng2) + 540) % 360) - 180 };
}

/** Angle of `bearing` relative to `heading`, wrapped to -180 < a ≤ 180 (positive = to the right). */
export function relativeAngleDeg(headingDeg: number, bearing: number): number {
  const a = normalizeDeg(bearing - headingDeg);
  return a > 180 ? a - 360 : a;
}

/** Ahead within ±30°, left/right up to ±150°, otherwise behind. */
export function sideOf(relativeDeg: number): RelativeSide {
  const abs = Math.abs(relativeDeg);
  if (abs <= AHEAD_HALF_ANGLE_DEG) return 'ahead';
  if (abs <= BEHIND_FROM_DEG) return relativeDeg > 0 ? 'right' : 'left';
  return 'behind';
}

/** Where `place` is for someone at `from` heading `headingDeg`. */
export function sideOfPlace(from: LatLng, headingDeg: number, place: LatLng): RelativeSide {
  return sideOf(relativeAngleDeg(headingDeg, bearingDeg(from, place)));
}
