import type { LatLng } from '../geo/lat-lng';
import type { Landmark } from './landmark';

export interface NearbyQuery {
  center: LatLng;
  radiusMeters: number;
  limit?: number;
}

/** A source of landmarks (Wikipedia + OSM today; Google Places could be added later). Server only. */
export interface LandmarkProvider {
  /** Landmarks within the radius, nearest first. An empty array is a valid answer. */
  findNearby(query: NearbyQuery, signal?: AbortSignal): Promise<Landmark[]>;
  /**
   * Reloads one landmark by its `Landmark.id`, or null if it no longer exists.
   * The narration endpoint uses this so it never trusts facts sent by the app.
   */
  getById(id: string, signal?: AbortSignal): Promise<Landmark | null>;
}
