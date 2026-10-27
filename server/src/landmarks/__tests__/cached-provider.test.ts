import { describe, expect, it, vi } from 'vitest';
import type { Landmark } from '@shared/landmarks/landmark';
import type { LandmarkProvider, NearbyQuery } from '@shared/landmarks/provider';
import type { CacheStore } from '../../cache/cache-store';
import { createMemoryCacheStore } from '../../cache/memory-cache-store';
import { HAGIA_SOPHIA, northOf, wikiLandmark } from '../__fixtures__/builders';
import { buildByIdCacheKey, buildNearbyCacheKey } from '../cache-key';
import { createCachedProvider, TTL_EMPTY_MS, TTL_PARTIAL_MS, TTL_RESULTS_MS } from '../cached-provider';
import type { DetailedLandmarkProvider } from '../detailed-provider';
import { LandmarkUpstreamError } from '../landmark-upstream-error';

function fakeInner(results: Landmark[] = [], byId: Landmark | null = null) {
  const findNearby = vi.fn((query: NearbyQuery, signal?: AbortSignal) => {
    void query;
    void signal;
    return Promise.resolve(results);
  });
  const getById = vi.fn((id: string, signal?: AbortSignal) => {
    void id;
    void signal;
    return Promise.resolve(byId);
  });
  const inner: LandmarkProvider = { findNearby, getById };
  return { inner, findNearby, getById };
}

describe('createCachedProvider.findNearby', () => {
  it('fetches around the rounded center with the bucketed radius plus slack', async () => {
    const { inner, findNearby } = fakeInner();
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    const center = { lat: 41.00864, lng: 28.98026 };
    await provider.findNearby({ center, radiusMeters: 400 });
    const expected = buildNearbyCacheKey(center, 400);
    expect(findNearby).toHaveBeenCalledWith({ center: expected.center, radiusMeters: expected.fetchRadiusMeters }, undefined);
  });

  it('serves a repeated request from the cache', async () => {
    const { inner, findNearby } = fakeInner([wikiLandmark()]);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    const query = { center: HAGIA_SOPHIA, radiusMeters: 300 };
    const first = await provider.findNearby(query);
    const second = await provider.findNearby(query);
    expect(findNearby).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('shares one cache entry between nearby points and similar radii', async () => {
    const { inner, findNearby } = fakeInner([wikiLandmark()]);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    await provider.findNearby({ center: { lat: 41.0086, lng: 28.9802 }, radiusMeters: 400 });
    await provider.findNearby({ center: { lat: 41.0089, lng: 28.9798 }, radiusMeters: 480 });
    expect(findNearby).toHaveBeenCalledTimes(1);
  });

  it('filters the cached superset back to the real center and radius, nearest first', async () => {
    const inside = wikiLandmark({ pageId: 1, name: 'Inside', location: northOf(HAGIA_SOPHIA, 100) });
    const nearer = wikiLandmark({ pageId: 2, name: 'Nearer', location: northOf(HAGIA_SOPHIA, 20) });
    const outside = wikiLandmark({ pageId: 3, name: 'Outside', location: northOf(HAGIA_SOPHIA, 450) });
    const { inner } = fakeInner([outside, inside, nearer]);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    const result = await provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 250 });
    expect(result.map((l) => l.name)).toEqual(['Nearer', 'Inside']);
  });

  it('applies the limit after filtering', async () => {
    const list = [1, 2, 3].map((n) => wikiLandmark({ pageId: n, location: northOf(HAGIA_SOPHIA, n * 10) }));
    const { inner } = fakeInner(list);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    const result = await provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 250, limit: 2 });
    expect(result.map((l) => l.id)).toEqual(['wiki:1', 'wiki:2']);
  });

  it('caches non-empty results for TTL_RESULTS_MS and empty ones for the shorter TTL_EMPTY_MS', async () => {
    expect(TTL_EMPTY_MS).toBeLessThan(TTL_RESULTS_MS);
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = { get: () => Promise.resolve(undefined), set, delete: () => Promise.resolve() };

    await createCachedProvider(fakeInner([wikiLandmark()]).inner, cache).findNearby({
      center: HAGIA_SOPHIA,
      radiusMeters: 300,
    });
    await createCachedProvider(fakeInner([]).inner, cache).findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 });

    const nearbyKey = buildNearbyCacheKey(HAGIA_SOPHIA, 300).key;
    const writes = set.mock.calls as unknown as Array<[string, unknown, number]>;
    const ttlOf = (key: string) => writes.filter(([k]) => k === key).map(([, , ttl]) => ttl);
    // Same key twice: first the non-empty list, then the empty one.
    expect(ttlOf(nearbyKey)).toEqual([TTL_RESULTS_MS, TTL_EMPTY_MS]);
  });

  it('refetches empty results after TTL_EMPTY_MS but not before', async () => {
    let time = 1_000;
    const cache = createMemoryCacheStore({ now: () => time });
    const { inner, findNearby } = fakeInner([]);
    const provider = createCachedProvider(inner, cache);
    const query = { center: HAGIA_SOPHIA, radiusMeters: 300 };
    await provider.findNearby(query);
    time += TTL_EMPTY_MS - 1;
    await provider.findNearby(query);
    expect(findNearby).toHaveBeenCalledTimes(1);
    time += 2;
    await provider.findNearby(query);
    expect(findNearby).toHaveBeenCalledTimes(2);
  });

  it('keeps non-empty results past the empty TTL', async () => {
    let time = 0;
    const cache = createMemoryCacheStore({ now: () => time });
    const { inner, findNearby } = fakeInner([wikiLandmark()]);
    const provider = createCachedProvider(inner, cache);
    const query = { center: HAGIA_SOPHIA, radiusMeters: 300 };
    await provider.findNearby(query);
    time += TTL_EMPTY_MS + 1;
    await provider.findNearby(query);
    expect(findNearby).toHaveBeenCalledTimes(1);
  });

  it('never caches errors from the inner provider', async () => {
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = { get: () => Promise.resolve(undefined), set, delete: () => Promise.resolve() };
    const inner: LandmarkProvider = {
      findNearby: () => Promise.reject(new LandmarkUpstreamError('wikipedia', 'HTTP 503', 503)),
      getById: () => Promise.reject(new LandmarkUpstreamError('overpass', 'HTTP 503', 503)),
    };
    const provider = createCachedProvider(inner, cache);
    await expect(provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 })).rejects.toBeInstanceOf(
      LandmarkUpstreamError,
    );
    await expect(provider.getById('wiki:1')).rejects.toBeInstanceOf(LandmarkUpstreamError);
    expect(set).not.toHaveBeenCalled();
  });

  it('retries the inner provider on the next request after an error', async () => {
    const findNearby = vi
      .fn<LandmarkProvider['findNearby']>()
      .mockRejectedValueOnce(new LandmarkUpstreamError('wikipedia', 'timed out'))
      .mockResolvedValueOnce([wikiLandmark()]);
    const provider = createCachedProvider({ findNearby, getById: () => Promise.resolve(null) }, createMemoryCacheStore());
    const query = { center: HAGIA_SOPHIA, radiusMeters: 300 };
    await expect(provider.findNearby(query)).rejects.toThrow();
    expect(await provider.findNearby(query)).toHaveLength(1);
  });

  it('treats a throwing cache as a miss and still answers', async () => {
    const cache: CacheStore = {
      get: () => Promise.reject(new Error('disk gone')),
      set: () => Promise.reject(new Error('disk gone')),
      delete: () => Promise.reject(new Error('disk gone')),
    };
    const { inner, findNearby } = fakeInner([wikiLandmark()]);
    const provider = createCachedProvider(inner, cache);
    const result = await provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 });
    expect(result).toHaveLength(1);
    expect(findNearby).toHaveBeenCalledTimes(1);
  });

  it('passes the abort signal to the inner provider', async () => {
    const { inner, findNearby } = fakeInner();
    const signal = new AbortController().signal;
    await createCachedProvider(inner, createMemoryCacheStore()).findNearby(
      { center: HAGIA_SOPHIA, radiusMeters: 300 },
      signal,
    );
    expect(findNearby.mock.calls[0][1]).toBe(signal);
  });
});

describe('createCachedProvider.getById', () => {
  it('caches a found landmark', async () => {
    const landmark = wikiLandmark({ pageId: 5 });
    const { inner, getById } = fakeInner([], landmark);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    expect(await provider.getById('wiki:5')).toEqual(landmark);
    expect(await provider.getById('wiki:5')).toEqual(landmark);
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it('caches "not found" briefly', async () => {
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = { get: () => Promise.resolve(undefined), set, delete: () => Promise.resolve() };
    await createCachedProvider(fakeInner([], null).inner, cache).getById('wiki:404');
    expect(set).toHaveBeenCalledWith(buildByIdCacheKey('wiki:404'), { landmark: null }, TTL_EMPTY_MS);
  });

  it('returns a cached "not found" without asking the inner provider again', async () => {
    const { inner, getById } = fakeInner([], null);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    expect(await provider.getById('wiki:404')).toBeNull();
    expect(await provider.getById('wiki:404')).toBeNull();
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it('stores found landmarks with the long TTL', async () => {
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = { get: () => Promise.resolve(undefined), set, delete: () => Promise.resolve() };
    await createCachedProvider(fakeInner([], wikiLandmark()).inner, cache).getById('wiki:1');
    expect(set).toHaveBeenCalledWith(buildByIdCacheKey('wiki:1'), expect.anything(), TTL_RESULTS_MS);
  });
});

describe('createCachedProvider: partial results', () => {
  function detailedInner(landmarks: Landmark[], partial: boolean) {
    const findNearbyDetailed = vi.fn((query: NearbyQuery, signal?: AbortSignal) => {
      void query;
      void signal;
      return Promise.resolve({ landmarks, partial });
    });
    const inner: DetailedLandmarkProvider = {
      findNearby: () => Promise.reject(new Error('the cache must use findNearbyDetailed')),
      findNearbyDetailed,
      getById: () => Promise.resolve(null),
    };
    return { inner, findNearbyDetailed };
  }

  function recordingCache() {
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = { get: () => Promise.resolve(undefined), set, delete: () => Promise.resolve() };
    const ttlOf = (key: string) =>
      (set.mock.calls as unknown as Array<[string, unknown, number]>).filter(([k]) => k === key).map(([, , ttl]) => ttl);
    return { cache, ttlOf };
  }

  it('caches a partial result for the short TTL_PARTIAL_MS', async () => {
    expect(TTL_PARTIAL_MS).toBeLessThan(TTL_EMPTY_MS);
    const landmark = wikiLandmark();
    const { cache, ttlOf } = recordingCache();
    await createCachedProvider(detailedInner([landmark], true).inner, cache).findNearby({
      center: HAGIA_SOPHIA,
      radiusMeters: 300,
    });
    expect(ttlOf(buildNearbyCacheKey(HAGIA_SOPHIA, 300).key)).toEqual([TTL_PARTIAL_MS]);
    expect(ttlOf(buildByIdCacheKey(landmark.id))).toEqual([TTL_PARTIAL_MS]);
  });

  it('uses the short TTL for an empty partial result too', async () => {
    const { cache, ttlOf } = recordingCache();
    await createCachedProvider(detailedInner([], true).inner, cache).findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 });
    expect(ttlOf(buildNearbyCacheKey(HAGIA_SOPHIA, 300).key)).toEqual([TTL_PARTIAL_MS]);
  });

  it('refetches a partial result after TTL_PARTIAL_MS to retry the missing source', async () => {
    let time = 0;
    const { inner, findNearbyDetailed } = detailedInner([wikiLandmark()], true);
    const provider = createCachedProvider(inner, createMemoryCacheStore({ now: () => time }));
    const query = { center: HAGIA_SOPHIA, radiusMeters: 300 };
    await provider.findNearby(query);
    time += TTL_PARTIAL_MS - 1;
    await provider.findNearby(query);
    expect(findNearbyDetailed).toHaveBeenCalledTimes(1);
    time += 2;
    await provider.findNearby(query);
    expect(findNearbyDetailed).toHaveBeenCalledTimes(2);
  });

  it('uses the full TTL for a complete detailed result', async () => {
    const { cache, ttlOf } = recordingCache();
    await createCachedProvider(detailedInner([wikiLandmark()], false).inner, cache).findNearby({
      center: HAGIA_SOPHIA,
      radiusMeters: 300,
    });
    expect(ttlOf(buildNearbyCacheKey(HAGIA_SOPHIA, 300).key)).toEqual([TTL_RESULTS_MS]);
  });
});

describe('createCachedProvider: by-id seeding', () => {
  it('serves getById from the cache after findNearby, without upstream calls', async () => {
    const landmark = wikiLandmark({ pageId: 77, kind: 'museum', osmTags: { tourism: 'museum' } });
    const { inner, getById } = fakeInner([landmark], null);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    await provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 });
    expect(await provider.getById('wiki:77')).toEqual(landmark);
    expect(getById).not.toHaveBeenCalled();
  });

  it('seeds every landmark of the list', async () => {
    const list = [1, 2, 3].map((n) => wikiLandmark({ pageId: n, location: northOf(HAGIA_SOPHIA, n * 10) }));
    const { inner, getById } = fakeInner(list);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    await provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 });
    for (const l of list) expect(await provider.getById(l.id)).toEqual(l);
    expect(getById).not.toHaveBeenCalled();
  });

  it('writes nothing when the nearby list came from the cache', async () => {
    const { inner } = fakeInner([wikiLandmark()], null);
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = {
      get: (key: string) => Promise.resolve(key.includes(':nearby:') ? ([wikiLandmark()] as never) : undefined),
      set,
      delete: () => Promise.resolve(),
    };
    await createCachedProvider(inner, cache).findNearby({ center: HAGIA_SOPHIA, radiusMeters: 300 });
    expect(set).not.toHaveBeenCalled();
  });
});

describe('createCachedProvider: limit', () => {
  it('applies the query limit after filtering to the real radius, not to the fetched list', async () => {
    const near = wikiLandmark({ pageId: 1, location: northOf(HAGIA_SOPHIA, 10) });
    const outside = wikiLandmark({ pageId: 2, location: northOf(HAGIA_SOPHIA, 400) });
    const alsoNear = wikiLandmark({ pageId: 3, location: northOf(HAGIA_SOPHIA, 20) });
    const { inner, findNearby } = fakeInner([near, outside, alsoNear]);
    const provider = createCachedProvider(inner, createMemoryCacheStore());
    const result = await provider.findNearby({ center: HAGIA_SOPHIA, radiusMeters: 250, limit: 2 });
    expect(result.map((l) => l.id)).toEqual(['wiki:1', 'wiki:3']);
    // The inner provider is asked for everything (no limit), so the cache holds the full list.
    expect(findNearby.mock.calls[0][0]).not.toHaveProperty('limit');
  });
});
