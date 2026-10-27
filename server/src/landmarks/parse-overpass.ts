import type { Landmark } from '@shared/landmarks/landmark';
import { classifyKind } from './classify-kind';
import { asFiniteNumber, asString, asWikidataId, isRecord } from './json-guards';

const OSM_TYPES = new Set(['node', 'way', 'relation']);

/** Tags copied into Landmark.osmTags. */
const SELECTED_TAGS = [
  'historic',
  'tourism',
  'amenity',
  'place',
  'bridge',
  'artwork_type',
  'religion',
  'denomination',
  'wikipedia',
  'wikidata',
] as const;

function stringTags(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const tags: Record<string, string> = {};
  for (const [key, tag] of Object.entries(value)) {
    if (typeof tag === 'string') tags[key] = tag;
  }
  return tags;
}

function elementToLandmark(element: unknown): Landmark | null {
  if (!isRecord(element)) return null;
  const type = asString(element.type);
  const id = asFiniteNumber(element.id);
  if (type === undefined || !OSM_TYPES.has(type) || id === undefined) return null;

  const tags = stringTags(element.tags);
  const name = tags.name?.trim();
  if (!name) return null;

  // Nodes carry lat/lon; ways and relations carry `center`.
  const point = isRecord(element.center) ? element.center : element;
  const lat = asFiniteNumber(point.lat);
  const lng = asFiniteNumber(point.lon);
  if (lat === undefined || lng === undefined) return null;

  const osmTags: Record<string, string> = {};
  for (const key of SELECTED_TAGS) {
    const tag = tags[key];
    if (tag !== undefined) osmTags[key] = tag;
  }
  const wikidataId = asWikidataId(tags.wikidata);

  return {
    id: `osm:${type}/${id}`,
    name,
    location: { lat, lng },
    kind: classifyKind(tags),
    ...(wikidataId ? { wikidataId } : {}),
    osmTags,
  };
}

/** Pure: Overpass JSON (`out center tags`) to landmarks. Unnamed or point-less elements are dropped. */
export function parseOverpass(json: unknown): Landmark[] {
  if (!isRecord(json) || !Array.isArray(json.elements)) return [];
  const landmarks: Landmark[] = [];
  for (const element of json.elements) {
    const landmark = elementToLandmark(element);
    if (landmark) landmarks.push(landmark);
  }
  return landmarks;
}
