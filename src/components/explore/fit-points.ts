import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

/** Below this the tap and the landmark are "the same place" and a plain fit would zoom to the maximum. */
const NEAR_METERS = 150;
/** Half-size, in degrees, of the box shown when the two points are nearly the same (~450 m). */
const NEAR_HALF_SPAN_DEG = 0.004;

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

const toMapCoordinate = (point: LatLng): MapCoordinate => ({ latitude: point.lat, longitude: point.lng });

/**
 * The coordinates to fit on screen so that both the tap and the landmark are
 * visible. When they are nearly the same point, returns a small box around the
 * landmark so the map zooms to a close, readable level instead.
 */
export function pointsToFit(tapped: LatLng, landmark: LatLng): MapCoordinate[] {
  if (distanceMeters(tapped, landmark) >= NEAR_METERS) {
    return [toMapCoordinate(tapped), toMapCoordinate(landmark)];
  }
  const d = NEAR_HALF_SPAN_DEG;
  return [
    { latitude: landmark.lat - d, longitude: landmark.lng - d },
    { latitude: landmark.lat + d, longitude: landmark.lng + d },
  ];
}
