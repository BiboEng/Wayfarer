import type { NearestLandmarkResponse } from '@shared/api/landmarks';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import type { NearbyQuery } from '@shared/landmarks/provider';
import type { CacheStore } from '../cache/cache-store';
import { createCachedProvider } from './cached-provider';
import { findNearestLandmark } from './find-nearest';
import { createWikiOsmProvider } from './provider';

export interface LandmarkServiceDeps {
  /** Contact (email or URL) for the upstream User-Agent. From config, never hard-coded. */
  contact: string;
  overpassUrl: string;
  cache: CacheStore;
  fetchFn?: typeof fetch;
}

export interface LandmarkService {
  findNearby(query: NearbyQuery, signal?: AbortSignal): Promise<Landmark[]>;
  findNearest(center: LatLng, signal?: AbortSignal): Promise<NearestLandmarkResponse>;
  getById(id: string, signal?: AbortSignal): Promise<Landmark | null>;
}

export function createLandmarkService(deps: LandmarkServiceDeps): LandmarkService {
  const provider = createCachedProvider(
    createWikiOsmProvider({ contact: deps.contact, overpassUrl: deps.overpassUrl, fetchFn: deps.fetchFn }),
    deps.cache,
  );
  return {
    findNearby: (query, signal) => provider.findNearby(query, signal),
    findNearest: (center, signal) => findNearestLandmark(provider, center, signal),
    getById: (id, signal) => provider.getById(id, signal),
  };
}

export { LandmarkUpstreamError } from './landmark-upstream-error';
