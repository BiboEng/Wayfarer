import type { Landmark } from '../landmarks/landmark';

/**
 * Query of GET /landmarks/nearby. Sent as a query string, so the server
 * validates and converts the values itself.
 */
export interface NearbyLandmarksQuery {
  lat: number;
  lng: number;
  /** Meters, NEARBY_RADIUS_MIN_M to NEARBY_RADIUS_MAX_M. */
  radius: number;
}

/** Response of GET /landmarks/nearby. Nearest first; empty when nothing is nearby. */
export interface NearbyLandmarksResponse {
  landmarks: Landmark[];
}

/** Query of GET /landmarks/nearest. */
export interface NearestLandmarkQuery {
  lat: number;
  lng: number;
}

/**
 * Response of GET /landmarks/nearest. `landmark` is null when nothing notable
 * was found within the widest step; that is a 200, not an error.
 */
export interface NearestLandmarkResponse {
  landmark: Landmark | null;
  /** The radius of the last step searched, in meters. */
  searchedRadiusMeters: number;
}
