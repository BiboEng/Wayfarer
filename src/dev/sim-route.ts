/** A simulated route: a polyline driven or walked at a constant speed. No React or Expo imports. */
import type { LatLng } from '@shared/geo/lat-lng';

export interface SimRoute {
  name: string;
  /** Meters per second. */
  speedMps: number;
  /** At least two points, roughly following real streets. */
  points: LatLng[];
}

export const kmhToMps = (kmh: number): number => kmh / 3.6;
