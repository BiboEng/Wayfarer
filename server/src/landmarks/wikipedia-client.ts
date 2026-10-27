import type { LatLng } from '@shared/geo/lat-lng';
import type { UpstreamHttp } from './http';
import { isRecord } from './json-guards';
import { LandmarkUpstreamError } from './landmark-upstream-error';

export const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

/** GeoSearch accepts 10..10000 m. */
const GEOSEARCH_RADIUS_MIN_M = 10;
const GEOSEARCH_RADIUS_MAX_M = 10_000;
/**
 * prop=extracts returns at most 20 extracts per request (exlimit), so one call
 * can only carry 20 pages with text. GeoSearch returns the nearest first.
 */
export const WIKIPEDIA_MAX_PAGES = 20;
const THUMBNAIL_SIZE_PX = 320;

/** Properties fetched for every page, shared by the search and by-id requests. */
const PAGE_PARAMS: Record<string, string> = {
  prop: 'coordinates|extracts|pageimages|pageprops|info',
  colimit: 'max',
  coprimary: 'primary',
  exintro: '1',
  explaintext: '1',
  exlimit: 'max',
  piprop: 'thumbnail',
  pithumbsize: String(THUMBNAIL_SIZE_PX),
  pilimit: 'max',
  ppprop: 'wikibase_item|disambiguation',
  inprop: 'url',
};

function buildUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params });
  return `${WIKIPEDIA_API_URL}?${query.toString()}`;
}

export function buildGeoSearchUrl(center: LatLng, radiusMeters: number): string {
  const radius = Math.round(Math.min(GEOSEARCH_RADIUS_MAX_M, Math.max(GEOSEARCH_RADIUS_MIN_M, radiusMeters)));
  return buildUrl({
    ...PAGE_PARAMS,
    generator: 'geosearch',
    ggscoord: `${center.lat}|${center.lng}`,
    ggsradius: String(radius),
    ggslimit: String(WIKIPEDIA_MAX_PAGES),
    ggsnamespace: '0',
  });
}

export function buildPageIdUrl(pageId: number): string {
  return buildUrl({ ...PAGE_PARAMS, pageids: String(Math.trunc(pageId)) });
}

function assertNoApiError(json: unknown): unknown {
  if (!isRecord(json)) throw new LandmarkUpstreamError('wikipedia', 'unexpected response');
  if ('error' in json) throw new LandmarkUpstreamError('wikipedia', 'API returned an error');
  return json;
}

export interface WikipediaClient {
  /** Raw JSON of one GeoSearch generator request. Parse with parseWikipediaPages. */
  geoSearch(center: LatLng, radiusMeters: number, signal?: AbortSignal, deadlineAt?: number): Promise<unknown>;
  /** Raw JSON for a single page id. */
  byPageId(pageId: number, signal?: AbortSignal): Promise<unknown>;
}

export function createWikipediaClient(http: UpstreamHttp): WikipediaClient {
  return {
    async geoSearch(center, radiusMeters, signal, deadlineAt) {
      const request = { url: buildGeoSearchUrl(center, radiusMeters), deadlineAt };
      return assertNoApiError(await http.getJson(request, signal));
    },
    async byPageId(pageId, signal) {
      return assertNoApiError(await http.getJson({ url: buildPageIdUrl(pageId) }, signal));
    },
  };
}
