import type { LatLng } from '../geo/lat-lng';

export type LandmarkKind =
  | 'monument'
  | 'building'
  | 'place_of_worship'
  | 'historic_district'
  | 'bridge'
  | 'square'
  | 'museum'
  | 'castle'
  | 'archaeological_site'
  | 'other';

export interface WikipediaInfo {
  pageId: number;
  title: string;
  url: string;
  /**
   * Plain-text intro of the article, at most WIKIPEDIA_EXTRACT_MAX_CHARS long.
   * The narration is grounded in this, so the cap also bounds the AI input.
   */
  extract: string;
  thumbnailUrl?: string;
}

export interface Landmark {
  /** Stable, source-prefixed id, e.g. "wiki:12345" or "osm:way/678". */
  id: string;
  name: string;
  location: LatLng;
  kind: LandmarkKind;
  /** Wikidata item id, e.g. "Q12506". The main key for merging sources. */
  wikidataId?: string;
  wikipedia?: WikipediaInfo;
  /** Selected OpenStreetMap tags (historic, tourism, amenity, ...). */
  osmTags?: Record<string, string>;
}
