import type { LatLng } from '@shared/geo/lat-lng';
import type { UpstreamHttp } from './http';
import { asString, isRecord } from './json-guards';
import { LandmarkUpstreamError } from './landmark-upstream-error';

const HEADER = '[out:json][timeout:10];';
const FOOTER = 'out center tags;';
/** Trivial historic=* values that would flood results with roadside markers. */
const IGNORED_HISTORIC = '^(boundary_stone|milestone|wayside_cross|wayside_shrine)$';

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
  return value;
}

/** Pure: Overpass QL for notable named features within the radius. */
export function buildAroundQuery(center: LatLng, radiusMeters: number): string {
  const around = `(around:${Math.round(finite(radiusMeters, 'radius'))},${finite(center.lat, 'lat')},${finite(center.lng, 'lng')})`;
  const filters = [
    `["historic"]["historic"!~"${IGNORED_HISTORIC}"]`,
    '["tourism"~"^(attraction|museum|artwork)$"]',
    '["amenity"="place_of_worship"]',
    '["place"="square"]',
    '["bridge"]["wikipedia"]',
    '["bridge"]["wikidata"]',
  ];
  const statements = filters.map((filter) => `  nwr["name"]${filter}${around};`);
  return `${HEADER}\n(\n${statements.join('\n')}\n);\n${FOOTER}`;
}

/** Pure: Overpass QL for one element, e.g. ("way", 678). */
export function buildByIdQuery(type: 'node' | 'way' | 'relation', id: number): string {
  return `${HEADER}\n${type}(${Math.trunc(finite(id, 'id'))});\n${FOOTER}`;
}

/** Pure: Overpass QL for features carrying one Wikidata id, e.g. "Q12345". */
export function buildByWikidataQuery(wikidataId: string): string {
  if (!/^Q\d+$/.test(wikidataId)) throw new RangeError('invalid Wikidata id');
  return `${HEADER}
nwr["wikidata"="${wikidataId}"];
${FOOTER}`;
}

export interface OverpassClient {
  /** Raw JSON for features around a point. Parse with parseOverpass. */
  around(center: LatLng, radiusMeters: number, signal?: AbortSignal): Promise<unknown>;
  /** Raw JSON for a single element. */
  byId(type: 'node' | 'way' | 'relation', id: number, signal?: AbortSignal): Promise<unknown>;
  /** Raw JSON for features with this Wikidata id. */
  byWikidata(wikidataId: string, signal?: AbortSignal): Promise<unknown>;
}

function assertComplete(json: unknown): unknown {
  if (!isRecord(json) || !Array.isArray(json.elements)) {
    throw new LandmarkUpstreamError('overpass', 'unexpected response');
  }
  // Overpass answers 200 with a "remark" when it ran out of time or memory; the data is partial.
  if (asString(json.remark)?.includes('runtime error')) {
    throw new LandmarkUpstreamError('overpass', 'query did not complete');
  }
  return json;
}

export function createOverpassClient(http: UpstreamHttp, endpointUrl: string): OverpassClient {
  const post = (query: string, signal?: AbortSignal) =>
    http.getJson({ url: endpointUrl, method: 'POST', body: `data=${encodeURIComponent(query)}`, retry: false }, signal);
  return {
    async around(center, radiusMeters, signal) {
      return assertComplete(await post(buildAroundQuery(center, radiusMeters), signal));
    },
    async byId(type, id, signal) {
      return assertComplete(await post(buildByIdQuery(type, id), signal));
    },
    async byWikidata(wikidataId, signal) {
      return assertComplete(await post(buildByWikidataQuery(wikidataId), signal));
    },
  };
}
