import { distanceMeters } from '@shared/geo/distance';
import type { Landmark } from '@shared/landmarks/landmark';
import type { LandmarkProvider, NearbyQuery } from '@shared/landmarks/provider';
import type { CacheStore } from '../cache/cache-store';
import { buildByIdCacheKey, buildNearbyCacheKey } from './cache-key';
import { isDetailedProvider } from './detailed-provider';
import { sortNearestFirst } from './merge';

const DAY_MS = 24 * 60 * 60 * 1000;
export const TTL_RESULTS_MS = 7 * DAY_MS;
export const TTL_EMPTY_MS = 1 * DAY_MS;
/** Results where one source failed: retry the missing source soon. */
export const TTL_PARTIAL_MS = 10 * 60 * 1000;

interface CachedById {
  landmark: Landmark | null;
}

/** Cache problems must never fail a request: treat them as a miss. */
async function safeGet<T>(cache: CacheStore, key: string): Promise<T | undefined> {
  try {
    return await cache.get<T>(key);
  } catch {
    return undefined;
  }
}

async function safeSet<T>(cache: CacheStore, key: string, value: T, ttlMs: number): Promise<void> {
  try {
    await cache.set(key, value, ttlMs);
  } catch {
    // ignore: the next request simply fetches again
  }
}

/**
 * Wraps a provider with the cache. Fetches around the rounded center with a
 * bucketed radius (+ slack), caches that, then filters to the caller's real
 * center and radius. Errors from the inner provider are never cached.
 */
export function createCachedProvider(inner: LandmarkProvider, cache: CacheStore): LandmarkProvider {
  async function fetchAndStore(query: NearbyQuery, key: string, signal?: AbortSignal): Promise<Landmark[]> {
    const { landmarks, partial } = isDetailedProvider(inner)
      ? await inner.findNearbyDetailed(query, signal)
      : { landmarks: await inner.findNearby(query, signal), partial: false };
    const ttl = partial ? TTL_PARTIAL_MS : landmarks.length > 0 ? TTL_RESULTS_MS : TTL_EMPTY_MS;
    await safeSet(cache, key, landmarks, ttl);
    // Also store each landmark by id so getById keeps its kind and OSM tags.
    await Promise.all(landmarks.map((l) => safeSet<CachedById>(cache, buildByIdCacheKey(l.id), { landmark: l }, ttl)));
    return landmarks;
  }

  async function findNearby(query: NearbyQuery, signal?: AbortSignal): Promise<Landmark[]> {
    const { key, center, fetchRadiusMeters } = buildNearbyCacheKey(query.center, query.radiusMeters);
    const fetched =
      (await safeGet<Landmark[]>(cache, key)) ??
      (await fetchAndStore({ center, radiusMeters: fetchRadiusMeters }, key, signal));
    const inRange = fetched.filter((l) => distanceMeters(query.center, l.location) <= query.radiusMeters);
    const sorted = sortNearestFirst(inRange, query.center);
    return query.limit === undefined ? sorted : sorted.slice(0, query.limit);
  }

  async function getById(id: string, signal?: AbortSignal): Promise<Landmark | null> {
    const key = buildByIdCacheKey(id);
    const cached = await safeGet<CachedById>(cache, key);
    if (cached !== undefined) return cached.landmark;
    const landmark = await inner.getById(id, signal);
    await safeSet<CachedById>(cache, key, { landmark }, landmark ? TTL_RESULTS_MS : TTL_EMPTY_MS);
    return landmark;
  }

  return { findNearby, getById };
}
