// DRAFT: finalized by the Lead in Phase 2. Code against it, but expect changes.
import type { LatLng } from '../geo/lat-lng';

export type LandmarkKind =
  | 'monument'
  | 'building'
  | 'place_of_worship'
  | 'historic_district'
  | 'bridge'
  | 'square'
  | 'museum'
  | 'other';

export interface WikipediaInfo {
  pageId: number;
  title: string;
  url: string;
  /** Plain-text extract; the narration is grounded in this. */
  extract: string;
  thumbnailUrl?: string;
}

export interface Landmark {
  /** Stable, source-prefixed id, e.g. "wiki:12345" or "osm:way/678". */
  id: string;
  name: string;
  location: LatLng;
  kind: LandmarkKind;
  wikipedia?: WikipediaInfo;
  /** Selected OpenStreetMap tags (historic, tourism, amenity, ...). */
  osmTags?: Record<string, string>;
}
