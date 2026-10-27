import type { LandmarkKind } from '@shared/landmarks/landmark';

const HISTORIC_KINDS: Record<string, LandmarkKind> = {
  castle: 'castle',
  fort: 'castle',
  archaeological_site: 'archaeological_site',
  monument: 'monument',
  memorial: 'monument',
  statue: 'monument',
  building: 'building',
  church: 'building',
  manor: 'building',
  palace: 'building',
  city_gate: 'building',
  tower: 'building',
  district: 'historic_district',
};

/** Pure: maps OSM tags to a LandmarkKind. Specific historic values win, then tourism/amenity/place/bridge. */
export function classifyKind(tags: Record<string, string>): LandmarkKind {
  const historic = tags.historic ? HISTORIC_KINDS[tags.historic] : undefined;
  if (historic === 'castle' || historic === 'archaeological_site') return historic;
  if (tags.tourism === 'museum') return 'museum';
  if (tags.amenity === 'place_of_worship') return 'place_of_worship';
  if (tags.place === 'square') return 'square';
  if (tags.bridge && tags.bridge !== 'no') return 'bridge';
  if (historic) return historic;
  if (tags.tourism === 'artwork') return 'monument';
  return 'other';
}
