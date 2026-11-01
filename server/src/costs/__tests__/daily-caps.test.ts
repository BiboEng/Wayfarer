import { describe, expect, it, vi } from 'vitest';
import type { CacheStore } from '../../cache/cache-store';
import { createMemoryCacheStore } from '../../cache/memory-cache-store';
import { createDailyCaps, utcDay, type CapKind, type DailyCaps } from '../daily-caps';

const NOON = Date.UTC(2026, 9, 27, 12, 0, 0);

function make(options: { llm?: number; tts?: number; now?: () => number; cache?: CacheStore } = {}) {
  const logs: string[] = [];
  const cache = options.cache ?? createMemoryCacheStore();
  const caps = createDailyCaps({
    cache,
    llmCalls: options.llm ?? 3,
    ttsChars: options.tts ?? 100,
    now: options.now ?? (() => NOON),
    log: (m) => logs.push(m),
  });
  return { caps, cache, logs };
}

/** True when the reservation was granted. */
const granted = async (caps: DailyCaps, kind: CapKind, amount: number): Promise<boolean> =>
  (await caps.tryReserve(kind, amount)) !== null;

describe('utcDay', () => {
  it('formats the UTC date', () => {
    expect(utcDay(Date.UTC(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(utcDay(Date.UTC(2026, 0, 6, 0, 0, 0))).toBe('2026-01-06');
  });
});

describe('createDailyCaps: reserve and release', () => {
  it('returns the UTC day the amount was booked on', async () => {
    const { caps } = make();
    expect(await caps.tryReserve('llm', 1)).toBe('2026-10-27');
  });

  it('returns null once the cap is reached', async () => {
    const { caps } = make({ llm: 3 });
    expect(await caps.tryReserve('llm', 1)).not.toBeNull();
    expect(await caps.tryReserve('llm', 1)).not.toBeNull();
    expect(await caps.tryReserve('llm', 1)).not.toBeNull();
    expect(await caps.tryReserve('llm', 1)).toBeNull();
  });

  it('allows a reservation that exactly fills the cap and refuses one over it', async () => {
    const { caps } = make({ tts: 100 });
    expect(await granted(caps, 'tts', 100)).toBe(true);
    expect(await granted(caps, 'tts', 1)).toBe(false);
    const other = make({ tts: 100 });
    expect(await other.caps.tryReserve('tts', 101)).toBeNull();
  });

  it('does not spend anything when a reservation is refused', async () => {
    const { caps } = make({ tts: 100 });
    expect(await granted(caps, 'tts', 60)).toBe(true);
    expect(await granted(caps, 'tts', 50)).toBe(false);
    expect(await granted(caps, 'tts', 40)).toBe(true);
  });

  it('a cap of 0 refuses everything', async () => {
    const { caps } = make({ llm: 0, tts: 0 });
    expect(await caps.tryReserve('llm', 1)).toBeNull();
    expect(await caps.tryReserve('tts', 1)).toBeNull();
  });

  it('keeps separate counters for llm and tts', async () => {
    const { caps } = make({ llm: 1, tts: 10 });
    expect(await granted(caps, 'llm', 1)).toBe(true);
    expect(await granted(caps, 'tts', 10)).toBe(true);
    expect(await granted(caps, 'llm', 1)).toBe(false);
  });

  it('release gives the budget back', async () => {
    const { caps } = make({ llm: 1 });
    const day = await caps.tryReserve('llm', 1);
    expect(await granted(caps, 'llm', 1)).toBe(false);
    await caps.release('llm', 1, day ?? '');
    expect(await granted(caps, 'llm', 1)).toBe(true);
  });

  it('release never takes the counter below zero', async () => {
    const { caps } = make({ tts: 10 });
    await caps.release('tts', 500, '2026-10-27');
    expect(await granted(caps, 'tts', 10)).toBe(true);
    expect(await granted(caps, 'tts', 1)).toBe(false);
  });

  it('stores counters in the cache so they survive a restart', async () => {
    const cache = createMemoryCacheStore();
    const first = make({ llm: 2, cache });
    await first.caps.tryReserve('llm', 1);
    await first.caps.tryReserve('llm', 1);
    const afterRestart = make({ llm: 2, cache });
    expect(await granted(afterRestart.caps, 'llm', 1)).toBe(false);
  });
});

describe('createDailyCaps: UTC day rollover', () => {
  it('starts fresh counters on the next UTC day', async () => {
    let time = Date.UTC(2026, 9, 27, 23, 59, 59);
    const { caps } = make({ llm: 1, now: () => time });
    expect(await caps.tryReserve('llm', 1)).toBe('2026-10-27');
    expect(await caps.tryReserve('llm', 1)).toBeNull();
    time = Date.UTC(2026, 9, 28, 0, 0, 0);
    expect(await caps.tryReserve('llm', 1)).toBe('2026-10-28');
  });

  it('does not reset within the same UTC day, whatever the local time', async () => {
    let time = Date.UTC(2026, 9, 27, 0, 0, 1);
    const { caps } = make({ llm: 1, now: () => time });
    expect(await granted(caps, 'llm', 1)).toBe(true);
    time = Date.UTC(2026, 9, 27, 23, 59, 59);
    expect(await granted(caps, 'llm', 1)).toBe(false);
  });

  it('a release after UTC midnight decrements the reserving day, not the new one', async () => {
    let time = Date.UTC(2026, 9, 27, 23, 59, 59);
    const { caps, cache } = make({ tts: 10, now: () => time });
    const day = await caps.tryReserve('tts', 10);
    expect(day).toBe('2026-10-27');

    time = Date.UTC(2026, 9, 28, 0, 0, 1);
    await caps.release('tts', 10, day ?? '');

    expect(await cache.get('cap:tts:2026-10-27')).toBe(0);
    expect(await cache.get('cap:tts:2026-10-28')).toBeUndefined(); // the new day was not touched
    // The new day's budget is still whole, and not inflated by the release either.
    expect(await granted(caps, 'tts', 10)).toBe(true);
    expect(await granted(caps, 'tts', 1)).toBe(false);
  });

  it('a late release does not refund budget that was spent on the new day', async () => {
    let time = Date.UTC(2026, 9, 27, 23, 59, 59);
    const { caps } = make({ tts: 10, now: () => time });
    const old = await caps.tryReserve('tts', 10);
    time = Date.UTC(2026, 9, 28, 0, 0, 1);
    expect(await granted(caps, 'tts', 10)).toBe(true); // new day fully used
    await caps.release('tts', 10, old ?? '');
    expect(await granted(caps, 'tts', 1)).toBe(false); // still full
  });

  it('keeps counters for about two days (so a restart late in the day still sees them)', async () => {
    const set = vi.fn(() => Promise.resolve());
    const cache: CacheStore = { get: () => Promise.resolve(undefined), set, delete: () => Promise.resolve() };
    await make({ cache }).caps.tryReserve('llm', 1);
    const call = set.mock.calls[0] as unknown as [string, number, number];
    expect(call[0]).toBe('cap:llm:2026-10-27');
    expect(call[2]).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });
});

describe('createDailyCaps: concurrent reservations', () => {
  it('lets only `cap` of many simultaneous reservations through', async () => {
    const { caps } = make({ llm: 5 });
    const results = await Promise.all(Array.from({ length: 20 }, () => caps.tryReserve('llm', 1)));
    expect(results.filter((r) => r !== null)).toHaveLength(5);
  });

  it('cannot be raced even when the cache is slow (read-modify-write never interleaves)', async () => {
    const inner = createMemoryCacheStore();
    const slow: CacheStore = {
      get: async (key) => {
        await new Promise((r) => setTimeout(r, 5));
        return inner.get(key);
      },
      set: async (key, value, ttl) => {
        await new Promise((r) => setTimeout(r, 5));
        return inner.set(key, value, ttl);
      },
      delete: (key) => inner.delete(key),
    };
    const { caps } = make({ tts: 100, cache: slow });
    const results = await Promise.all([caps.tryReserve('tts', 60), caps.tryReserve('tts', 60), caps.tryReserve('tts', 30)]);
    expect(results.map((r) => r !== null)).toEqual([true, false, true]);
  });

  it('mixed reserve and release calls stay consistent', async () => {
    const { caps } = make({ llm: 2 });
    const results = await Promise.all([
      caps.tryReserve('llm', 1),
      caps.tryReserve('llm', 1),
      caps.release('llm', 1, '2026-10-27'),
      caps.tryReserve('llm', 1),
      caps.tryReserve('llm', 1),
    ]);
    expect(results).toEqual(['2026-10-27', '2026-10-27', undefined, '2026-10-27', null]);
  });

  it('keeps working after a cache failure in one operation', async () => {
    let failNext = true;
    const inner = createMemoryCacheStore();
    const flaky: CacheStore = {
      get: (key) => {
        if (failNext) {
          failNext = false;
          return Promise.reject(new Error('cache down'));
        }
        return inner.get(key);
      },
      set: (key, value, ttl) => inner.set(key, value, ttl),
      delete: (key) => inner.delete(key),
    };
    const { caps } = make({ llm: 1, cache: flaky });
    await expect(caps.tryReserve('llm', 1)).rejects.toThrow('cache down');
    expect(await granted(caps, 'llm', 1)).toBe(true);
  });
});

describe('createDailyCaps: logging', () => {
  it('logs once per cap per day when the cap is reached', async () => {
    const { caps, logs } = make({ llm: 1 });
    for (let i = 0; i < 4; i += 1) await caps.tryReserve('llm', 1);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/LLM calls/);
    expect(logs[0]).toContain('2026-10-27');
  });

  it('logs the llm and tts caps separately', async () => {
    const { caps, logs } = make({ llm: 0, tts: 0 });
    await caps.tryReserve('llm', 1);
    await caps.tryReserve('tts', 1);
    await caps.tryReserve('llm', 1);
    expect(logs).toHaveLength(2);
  });

  it('logs again on the next day', async () => {
    let time = Date.UTC(2026, 9, 27, 12);
    const { caps, logs } = make({ llm: 0, now: () => time });
    await caps.tryReserve('llm', 1);
    time = Date.UTC(2026, 9, 28, 12);
    await caps.tryReserve('llm', 1);
    expect(logs).toHaveLength(2);
  });

  it('does not log while under the cap', async () => {
    const { caps, logs } = make({ llm: 5 });
    await caps.tryReserve('llm', 1);
    expect(logs).toEqual([]);
  });
});
