import type { Landmark } from '@shared/landmarks/landmark';

/** Hagia Sophia, roughly. */
export const HAGIA_SOPHIA = { lat: 41.00833, lng: 28.98 };

/** A Wikipedia-backed landmark. */
export function wikiLandmark(overrides: Partial<Landmark> & { pageId?: number } = {}): Landmark {
  const { pageId = 1, ...rest } = overrides;
  const name = rest.name ?? 'Hagia Sophia';
  return {
    id: `wiki:${pageId}`,
    name,
    location: HAGIA_SOPHIA,
    kind: 'other',
    wikipedia: { pageId, title: name, url: `https://en.wikipedia.org/wiki/${pageId}`, extract: 'Intro text.' },
    ...rest,
  };
}

/** An OpenStreetMap-only landmark. */
export function osmLandmark(overrides: Partial<Landmark> = {}): Landmark {
  return {
    id: 'osm:way/1',
    name: 'Hagia Sophia',
    location: HAGIA_SOPHIA,
    kind: 'place_of_worship',
    osmTags: { amenity: 'place_of_worship' },
    ...overrides,
  };
}

/** A point `meters` due north of `from` (1 degree of latitude is about 111,195 m). */
export function northOf(from: { lat: number; lng: number }, meters: number): { lat: number; lng: number } {
  return { lat: from.lat + meters / 111_195, lng: from.lng };
}
