import { ENDPOINTS } from '@shared/api/endpoints';
import type {
  NearbyLandmarksQuery,
  NearbyLandmarksResponse,
  NearestLandmarkQuery,
  NearestLandmarkResponse,
} from '@shared/api/landmarks';
import type { LatLng } from '@shared/geo/lat-lng';

import type { ApiResult } from './client';
import { apiClient } from './instance';
import { withQuery } from './query-string';

/** The server may widen the search up to four times, so allow longer than the default. */
const NEAREST_TIMEOUT_MS = 20_000;

/** Landmarks within `radiusMeters` of `center`, nearest first. */
export function getNearbyLandmarks(
  center: LatLng,
  radiusMeters: number,
): Promise<ApiResult<NearbyLandmarksResponse>> {
  const query: NearbyLandmarksQuery = { lat: center.lat, lng: center.lng, radius: radiusMeters };
  return apiClient.get<NearbyLandmarksResponse>(withQuery(ENDPOINTS.landmarksNearby, { ...query }));
}

/** The nearest notable landmark to `point`, widening the search on the server. */
export function getNearestLandmark(point: LatLng): Promise<ApiResult<NearestLandmarkResponse>> {
  const query: NearestLandmarkQuery = { lat: point.lat, lng: point.lng };
  return apiClient.get<NearestLandmarkResponse>(withQuery(ENDPOINTS.landmarksNearest, { ...query }), {
    timeoutMs: NEAREST_TIMEOUT_MS,
  });
}
