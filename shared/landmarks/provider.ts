// DRAFT: finalized by the Lead in Phase 2. Implemented on the server only.
import type { LatLng } from '../geo/lat-lng';
import type { Landmark } from './landmark';

export interface NearbyQuery {
  center: LatLng;
  radiusMeters: number;
  limit?: number;
}

/** A source of landmarks (Wikipedia + OSM today; Google Places could be added later). */
export interface LandmarkProvider {
  findNearby(query: NearbyQuery, signal?: AbortSignal): Promise<Landmark[]>;
}
