import type { Landmark } from '@shared/landmarks/landmark';
import type { NearbyQuery } from '@shared/landmarks/provider';
import { SERVER_VERSION } from '../config/version';
import {
  buildUserAgent,
  createUpstreamHttp,
  OVERPASS_TIMEOUT_MS,
  WIKIPEDIA_TIMEOUT_MS,
  type UpstreamHttp,
} from './http';
import { NEARBY_RADIUS_MAX_M } from '@shared/landmarks/search';
import { FIND_NEARBY_BUDGET_MS, OVERPASS_MAX_CALL_MS, remainingMs, withTimeout } from './budget';
import type { DetailedLandmarkProvider, DetailedNearby } from './detailed-provider';
import { LandmarkUpstreamError } from './landmark-upstream-error';
import { CACHE_SLACK_M } from './cache-key';
import { capOsmOnly } from './cap';
import { enrichFromOsm } from './enrich-wiki-landmark';
import { mergeLandmarks } from './merge';
import { createOverpassClient, type OverpassClient } from './overpass-client';
import { parseOverpass } from './parse-overpass';
import { parseWikipediaPages } from './parse-wikipedia';
import { createLimiter, type SleepFn } from './throttle';
import { createWikipediaClient, type WikipediaClient } from './wikipedia-client';

/**
 * Overpass is skipped above this radius: the nearby maximum plus the cache's
 * slack, so a cached request at the maximum radius still includes OSM.
 */
export const OVERPASS_MAX_RADIUS_M = NEARBY_RADIUS_MAX_M + CACHE_SLACK_M;

export interface WikiOsmProviderDeps {
  /** Contact for the User-Agent (email or URL), from config. */
  contact: string;
  overpassUrl: string;
  fetchFn?: typeof fetch;
  sleep?: SleepFn;
  now?: () => number;
}

const OSM_ID = /^osm:(node|way|relation)\/(\d+)$/;
const WIKI_ID = /^wiki:(\d+)$/;

function createHttp(deps: WikiOsmProviderDeps, name: string, timeoutMs: number, minIntervalMs: number, concurrency: number): UpstreamHttp {
  return createUpstreamHttp({
    name,
    userAgent: buildUserAgent(SERVER_VERSION, deps.contact),
    timeoutMs,
    fetchFn: deps.fetchFn,
    sleep: deps.sleep,
    limiter: createLimiter({ concurrency, minIntervalMs, now: deps.now, sleep: deps.sleep }),
  });
}

export function createWikiOsmProvider(deps: WikiOsmProviderDeps): DetailedLandmarkProvider {
  const wikipedia: WikipediaClient = createWikipediaClient(createHttp(deps, 'wikipedia', WIKIPEDIA_TIMEOUT_MS, 100, 2));
  const overpass: OverpassClient = createOverpassClient(
    createHttp(deps, 'overpass', OVERPASS_TIMEOUT_MS, 500, 1),
    deps.overpassUrl,
  );

  async function findNearbyDetailed(query: NearbyQuery, signal?: AbortSignal): Promise<DetailedNearby> {
    const { center, radiusMeters } = query;
    const deadlineAt = Date.now() + FIND_NEARBY_BUDGET_MS;
    const useOverpass = radiusMeters <= OVERPASS_MAX_RADIUS_M;
    // Overpass: one attempt, no retry, and it gives up (also while queued) when the budget runs out.
    const overpassSignal = withTimeout(Math.min(OVERPASS_MAX_CALL_MS, remainingMs(deadlineAt)), signal);
    const wikiSignal = withTimeout(remainingMs(deadlineAt), signal);
    const [wikiResult, osmResult] = await Promise.allSettled([
      wikipedia.geoSearch(center, radiusMeters, wikiSignal, deadlineAt),
      useOverpass ? overpass.around(center, radiusMeters, overpassSignal) : Promise.resolve(null),
    ]);
    // A caller that went away is not an upstream failure.
    if (signal?.aborted) throw signal.reason;

    if (wikiResult.status === 'rejected' && (osmResult.status === 'rejected' || !useOverpass)) {
      throw wikiResult.reason instanceof LandmarkUpstreamError
        ? wikiResult.reason
        : new LandmarkUpstreamError('landmarks', 'all sources failed');
    }
    const wikiLandmarks = wikiResult.status === 'fulfilled' ? parseWikipediaPages(wikiResult.value) : [];
    const osmLandmarks = osmResult.status === 'fulfilled' && osmResult.value ? parseOverpass(osmResult.value) : [];
    const merged = capOsmOnly(mergeLandmarks(wikiLandmarks, osmLandmarks, center));
    const partial = wikiResult.status === 'rejected' || (useOverpass && osmResult.status === 'rejected');
    return { landmarks: merged, partial };
  }

  async function findNearby(query: NearbyQuery, signal?: AbortSignal): Promise<Landmark[]> {
    const { landmarks } = await findNearbyDetailed(query, signal);
    return query.limit === undefined ? landmarks : landmarks.slice(0, query.limit);
  }

  async function getById(id: string, signal?: AbortSignal): Promise<Landmark | null> {
    const wikiMatch = WIKI_ID.exec(id);
    if (wikiMatch) {
      const landmarks = parseWikipediaPages(await wikipedia.byPageId(Number(wikiMatch[1]), signal));
      const landmark = landmarks[0];
      if (!landmark) return null;
      return enrichFromOsm(landmark, overpass, withTimeout(OVERPASS_MAX_CALL_MS, signal));
    }
    const osmMatch = OSM_ID.exec(id);
    if (osmMatch) {
      const type = osmMatch[1] as 'node' | 'way' | 'relation'; // narrowed by the regex above
      const landmarks = parseOverpass(await overpass.byId(type, Number(osmMatch[2]), signal));
      return landmarks[0] ?? null;
    }
    return null;
  }

  return { findNearby, findNearbyDetailed, getById };
}
