/**
 * Where a simulated traveller is after some time on a route. Pure: no React or Expo imports.
 * Positions are interpolated linearly between points (fine for segments of a few hundred meters).
 */
import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

import type { LocationFix } from '@/location/types';
import { bearingDeg } from '@/tour/bearing';

import type { SimRoute } from './sim-route';

export interface PreparedRoute {
  points: LatLng[];
  /** Distance from the start to each point, in meters. */
  cumulativeM: number[];
  totalM: number;
  speedMps: number;
}

export interface PlaybackOptions {
  /** Epoch ms of the route's start; fix timestamps are startedAt + elapsed. */
  startedAt: number;
  /** Random position error up to this many meters (0 = none). Deterministic for a given seed. */
  jitterM?: number;
  seed?: number;
  /** Reported accuracy in meters. */
  accuracyM?: number;
}

export interface PlaybackFix {
  fix: LocationFix;
  /** The end of the route was reached; later fixes stay at the last point. */
  finished: boolean;
}

const METERS_PER_DEGREE_LAT = 111_320;
const DEFAULT_ACCURACY_M = 5;

export function prepareRoute(route: SimRoute): PreparedRoute {
  if (route.points.length < 2) throw new Error('A route needs at least two points.');
  const cumulativeM = [0];
  for (let i = 1; i < route.points.length; i++) {
    cumulativeM.push(cumulativeM[i - 1] + distanceMeters(route.points[i - 1], route.points[i]));
  }
  return { points: route.points, cumulativeM, totalM: cumulativeM[cumulativeM.length - 1], speedMps: route.speedMps };
}

/** Total time to travel the route, in milliseconds. */
export function routeDurationMs(route: PreparedRoute): number {
  return (route.totalM / route.speedMps) * 1000;
}

/** The fix after `elapsedMs` on the route. */
export function fixAt(route: PreparedRoute, elapsedMs: number, options: PlaybackOptions): PlaybackFix {
  const traveled = Math.max(0, (elapsedMs / 1000) * route.speedMps);
  const finished = traveled >= route.totalM;
  const segment = segmentAt(route, Math.min(traveled, route.totalM));
  const from = route.points[segment];
  const to = route.points[segment + 1];
  const segmentLength = route.cumulativeM[segment + 1] - route.cumulativeM[segment];
  const t = segmentLength > 0 ? (Math.min(traveled, route.totalM) - route.cumulativeM[segment]) / segmentLength : 1;
  const point = jitter(
    { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t },
    options.jitterM ?? 0,
    (options.seed ?? 1) ^ Math.round(elapsedMs),
  );

  return {
    finished,
    fix: {
      lat: point.lat,
      lng: point.lng,
      accuracyM: options.accuracyM ?? DEFAULT_ACCURACY_M,
      speedMps: finished ? 0 : route.speedMps,
      headingDeg: finished ? null : bearingDeg(from, to),
      timestamp: options.startedAt + Math.max(0, elapsedMs),
    },
  };
}

/** Index of the segment (points[i] → points[i + 1]) containing `distance`, skipping empty ones. */
function segmentAt(route: PreparedRoute, distance: number): number {
  const last = route.points.length - 2;
  for (let i = 0; i < last; i++) {
    if (distance < route.cumulativeM[i + 1]) return i;
  }
  return last;
}

function jitter(point: LatLng, meters: number, seed: number): LatLng {
  if (meters <= 0) return point;
  const random = mulberry32(seed);
  const dNorth = (random() * 2 - 1) * meters;
  const dEast = (random() * 2 - 1) * meters;
  return {
    lat: point.lat + dNorth / METERS_PER_DEGREE_LAT,
    lng: point.lng + dEast / (METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180)),
  };
}

/** Small seeded PRNG (mulberry32), so jittered routes are reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
