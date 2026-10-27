import { describe, expect, it, vi } from 'vitest';
import type { Landmark } from '@shared/landmarks/landmark';
import type { LandmarkProvider, NearbyQuery } from '@shared/landmarks/provider';
import { EXPLORE_RADIUS_STEPS_M } from '@shared/landmarks/search';
import { HAGIA_SOPHIA, northOf, osmLandmark, wikiLandmark } from '../__fixtures__/builders';
import { NEAREST_BUDGET_MS } from '../budget';
import { findNearestLandmark } from '../find-nearest';
import { LandmarkUpstreamError } from '../landmark-upstream-error';

/** Provider answering by radius from a table; unknown radii return []. */
function providerByRadius(table: Record<number, Landmark[]>) {
  const findNearby = vi.fn((query: NearbyQuery, signal?: AbortSignal) => {
    void signal;
    return Promise.resolve(table[query.radiusMeters] ?? []);
  });
  const provider: LandmarkProvider = { findNearby, getById: () => Promise.resolve(null) };
  return { provider, findNearby };
}

const radiiCalled = (findNearby: ReturnType<typeof providerByRadius>['findNearby']) =>
  findNearby.mock.calls.map(([query]) => query.radiusMeters);

describe('findNearestLandmark', () => {
  it('stops at the first step that has a Wikipedia-backed landmark', async () => {
    const hit = wikiLandmark({ pageId: 3 });
    const { provider, findNearby } = providerByRadius({ 2000: [hit] });
    const result = await findNearestLandmark(provider, HAGIA_SOPHIA);
    expect(result).toEqual({ landmark: hit, searchedRadiusMeters: 2000 });
    expect(radiiCalled(findNearby)).toEqual([500, 2000]);
  });

  it('answers from the first step when it already has a hit', async () => {
    const { provider, findNearby } = providerByRadius({ 500: [wikiLandmark()] });
    const result = await findNearestLandmark(provider, HAGIA_SOPHIA);
    expect(result.searchedRadiusMeters).toBe(500);
    expect(findNearby).toHaveBeenCalledTimes(1);
  });

  it('skips OSM-only hits and keeps widening', async () => {
    const wiki = wikiLandmark({ pageId: 9, location: northOf(HAGIA_SOPHIA, 4000) });
    const { provider, findNearby } = providerByRadius({ 500: [osmLandmark()], 2000: [osmLandmark()], 5000: [wiki] });
    const result = await findNearestLandmark(provider, HAGIA_SOPHIA);
    expect(result.landmark?.id).toBe('wiki:9');
    expect(result.searchedRadiusMeters).toBe(5000);
    expect(radiiCalled(findNearby)).toEqual([500, 2000, 5000]);
  });

  it('returns null with the last radius after the final step', async () => {
    const { provider, findNearby } = providerByRadius({ 500: [osmLandmark()] });
    const result = await findNearestLandmark(provider, { lat: 0, lng: -30 });
    expect(result).toEqual({ landmark: null, searchedRadiusMeters: 10000 });
    expect(radiiCalled(findNearby)).toEqual([...EXPLORE_RADIUS_STEPS_M]);
  });

  it('picks the closest Wikipedia-backed landmark, ignoring a nearer OSM-only one', async () => {
    const osmNear = osmLandmark({ location: HAGIA_SOPHIA });
    const wikiFar = wikiLandmark({ pageId: 1, location: northOf(HAGIA_SOPHIA, 300) });
    const wikiNear = wikiLandmark({ pageId: 2, location: northOf(HAGIA_SOPHIA, 100) });
    const { provider } = providerByRadius({ 500: [osmNear, wikiFar, wikiNear] });
    const result = await findNearestLandmark(provider, HAGIA_SOPHIA);
    expect(result.landmark?.id).toBe('wiki:2');
  });

  it('uses the custom steps and passes the center and a shared derived signal on', async () => {
    const { provider, findNearby } = providerByRadius({});
    const result = await findNearestLandmark(provider, HAGIA_SOPHIA, undefined, [100, 200]);
    expect(result).toEqual({ landmark: null, searchedRadiusMeters: 200 });
    expect(findNearby.mock.calls[0][0]).toEqual({ center: HAGIA_SOPHIA, radiusMeters: 100 });
    const first = findNearby.mock.calls[0][1];
    expect(first).toBeInstanceOf(AbortSignal);
    expect(findNearby.mock.calls[1][1]).toBe(first);
  });

  it('aborts the derived signal when the caller aborts, and rethrows the provider error', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const provider: LandmarkProvider = {
      findNearby: (_query, signal) => {
        seen = signal;
        controller.abort(new Error('client left'));
        return Promise.reject(signal?.reason);
      },
      getById: () => Promise.resolve(null),
    };
    await expect(findNearestLandmark(provider, HAGIA_SOPHIA, controller.signal)).rejects.toThrow('client left');
    expect(seen?.aborted).toBe(true);
  });

  // AbortSignal.timeout uses Node's own timers (not faked by vitest), so the test controls it by hand.
  function controllableBudget() {
    const budget = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(budget.signal);
    return { budget, timeout };
  }

  const neverAnswers: LandmarkProvider = {
    findNearby: (_query, signal) =>
      new Promise<Landmark[]>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      }),
    getById: () => Promise.resolve(null),
  };

  it('throws LandmarkUpstreamError when the 16 s budget runs out', async () => {
    const { budget, timeout } = controllableBudget();
    try {
      const result = findNearestLandmark(neverAnswers, HAGIA_SOPHIA).catch((e: unknown) => e);
      expect(timeout).toHaveBeenCalledWith(NEAREST_BUDGET_MS);
      expect(NEAREST_BUDGET_MS).toBe(16_000);
      budget.abort(new DOMException('timed out', 'TimeoutError'));
      expect(await result).toBeInstanceOf(LandmarkUpstreamError);
    } finally {
      timeout.mockRestore();
    }
  });

  it('keeps the caller abort as is (not an upstream error) even if the budget also ran out', async () => {
    const { timeout } = controllableBudget();
    try {
      const caller = new AbortController();
      const result = findNearestLandmark(neverAnswers, HAGIA_SOPHIA, caller.signal).catch((e: unknown) => e);
      const reason = new Error('client left');
      caller.abort(reason);
      expect(await result).toBe(reason);
    } finally {
      timeout.mockRestore();
    }
  });

  it('creates one budget for the whole search, not one per step', async () => {
    const { budget, timeout } = controllableBudget();
    try {
      let calls = 0;
      const provider: LandmarkProvider = {
        findNearby: (_query, signal) => {
          calls += 1;
          if (calls === 1) return Promise.resolve([]);
          return new Promise<Landmark[]>((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason));
          });
        },
        getById: () => Promise.resolve(null),
      };
      const result = findNearestLandmark(provider, HAGIA_SOPHIA).catch((e: unknown) => e);
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      budget.abort(new DOMException('timed out', 'TimeoutError'));
      expect(await result).toBeInstanceOf(LandmarkUpstreamError);
      expect(calls).toBe(2);
      expect(timeout).toHaveBeenCalledTimes(1);
    } finally {
      timeout.mockRestore();
    }
  });

  it('with no steps reports radius 0 and null', async () => {
    const { provider } = providerByRadius({});
    expect(await findNearestLandmark(provider, HAGIA_SOPHIA, undefined, [])).toEqual({
      landmark: null,
      searchedRadiusMeters: 0,
    });
  });

  it('lets provider errors through instead of reporting null', async () => {
    const provider: LandmarkProvider = {
      findNearby: () => Promise.reject(new Error('down')),
      getById: () => Promise.resolve(null),
    };
    await expect(findNearestLandmark(provider, HAGIA_SOPHIA)).rejects.toThrow('down');
  });
});
