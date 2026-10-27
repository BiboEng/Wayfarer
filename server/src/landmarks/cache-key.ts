import type { LatLng } from '@shared/geo/lat-lng';

/** Bump when the cached shape or the fetching logic changes. */
export const CACHE_KEY_VERSION = 'v1';
/** Radii are rounded up to one of these, so near-identical requests share an entry. */
export const RADIUS_BUCKETS_M = [250, 500, 1000, 2000, 5000, 10000] as const;
/**
 * Extra radius fetched on top of the bucket. Rounding the center to 3 decimals
 * moves it by at most ~80 m, so this keeps everything the caller could see.
 */
export const CACHE_SLACK_M = 150;
// Note: for the 10000 bucket the fetch radius is 10150, but Wikipedia GeoSearch caps at 10000 from the
// rounded center, so a page up to ~80 m beyond the caller's 10 km edge can be missed. Accepted.

export interface NearbyCacheKey {
  key: string;
  /** Rounded center to fetch around. */
  center: LatLng;
  /** Bucketed radius plus slack. */
  fetchRadiusMeters: number;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000 + 0; // "+ 0" turns -0 into 0
}

export function radiusBucket(radiusMeters: number): number {
  const buckets = RADIUS_BUCKETS_M;
  return buckets.find((bucket) => radiusMeters <= bucket) ?? buckets[buckets.length - 1];
}

export function buildNearbyCacheKey(center: LatLng, radiusMeters: number): NearbyCacheKey {
  const rounded = { lat: roundCoordinate(center.lat), lng: roundCoordinate(center.lng) };
  const bucket = radiusBucket(radiusMeters);
  return {
    key: `landmarks:${CACHE_KEY_VERSION}:nearby:${rounded.lat.toFixed(3)}:${rounded.lng.toFixed(3)}:${bucket}`,
    center: rounded,
    fetchRadiusMeters: bucket + CACHE_SLACK_M,
  };
}

export function buildByIdCacheKey(id: string): string {
  return `landmarks:${CACHE_KEY_VERSION}:id:${id}`;
}
