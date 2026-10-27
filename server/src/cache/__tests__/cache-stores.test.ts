import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CacheStore } from '../cache-store';
import { createCacheStore } from '../create-cache-store';
import { createMemoryCacheStore } from '../memory-cache-store';
import { createSqliteCacheStore } from '../sqlite-cache-store';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wayfarer-cache-'));
});
afterAll(() => {
  // The OS may keep the sqlite file locked for a moment on Windows; cleanup is best effort.
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

let counter = 0;
const freshPath = () => join(dir, `cache-${(counter += 1)}.db`);

interface Harness {
  store: CacheStore;
  advance(ms: number): void;
}

/** Contract shared by every store. */
function describeStore(name: string, make: () => Harness) {
  describe(`${name} (store contract)`, () => {
    it('returns undefined for a missing key', async () => {
      expect(await make().store.get('nope')).toBeUndefined();
    });

    it('round-trips JSON values', async () => {
      const { store } = make();
      const value = { a: [1, 2, { b: 'ü' }], c: null, d: true };
      await store.set('k', value, 1000);
      expect(await store.get('k')).toEqual(value);
    });

    it('stores empty arrays and falsy values', async () => {
      const { store } = make();
      await store.set('arr', [], 1000);
      await store.set('zero', 0, 1000);
      await store.set('null', null, 1000);
      expect(await store.get('arr')).toEqual([]);
      expect(await store.get('zero')).toBe(0);
      expect(await store.get('null')).toBeNull();
    });

    it('overwrites an existing key', async () => {
      const { store } = make();
      await store.set('k', 1, 1000);
      await store.set('k', 2, 1000);
      expect(await store.get('k')).toBe(2);
    });

    it('expires entries at their TTL', async () => {
      const { store, advance } = make();
      await store.set('k', 'v', 1000);
      advance(999);
      expect(await store.get('k')).toBe('v');
      advance(1);
      expect(await store.get('k')).toBeUndefined();
    });

    it('gives each key its own TTL', async () => {
      const { store, advance } = make();
      await store.set('short', 1, 100);
      await store.set('long', 2, 10_000);
      advance(500);
      expect(await store.get('short')).toBeUndefined();
      expect(await store.get('long')).toBe(2);
    });

    it('a rewrite restarts the TTL', async () => {
      const { store, advance } = make();
      await store.set('k', 1, 1000);
      advance(800);
      await store.set('k', 2, 1000);
      advance(800);
      expect(await store.get('k')).toBe(2);
    });

    it('deletes keys, and deleting a missing key is fine', async () => {
      const { store } = make();
      await store.set('k', 1, 1000);
      await store.delete('k');
      await store.delete('never-existed');
      expect(await store.get('k')).toBeUndefined();
    });

    it('returns copies, so callers cannot corrupt the cache', async () => {
      const { store } = make();
      await store.set('k', { list: [1] }, 1000);
      const first = await store.get<{ list: number[] }>('k');
      first?.list.push(2);
      expect(await store.get('k')).toEqual({ list: [1] });
    });
  });
}

function clock() {
  let time = 1_000_000;
  return { now: () => time, advance: (ms: number) => void (time += ms) };
}

describeStore('memory store', () => {
  const c = clock();
  return { store: createMemoryCacheStore({ now: c.now }), advance: c.advance };
});

describeStore('sqlite store', () => {
  const c = clock();
  return { store: createSqliteCacheStore({ path: freshPath(), now: c.now }), advance: c.advance };
});

describeStore('sqlite store (:memory:)', () => {
  const c = clock();
  return { store: createSqliteCacheStore({ path: ':memory:', now: c.now }), advance: c.advance };
});

describe('memory store limits', () => {
  it('evicts the oldest entry when full', async () => {
    const store = createMemoryCacheStore({ maxEntries: 2 });
    await store.set('a', 1, 1000);
    await store.set('b', 2, 1000);
    await store.set('c', 3, 1000);
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBe(2);
    expect(await store.get('c')).toBe(3);
  });

  it('counts a rewritten key as newest', async () => {
    const store = createMemoryCacheStore({ maxEntries: 2 });
    await store.set('a', 1, 1000);
    await store.set('b', 2, 1000);
    await store.set('a', 10, 1000);
    await store.set('c', 3, 1000);
    expect(await store.get('b')).toBeUndefined();
    expect(await store.get('a')).toBe(10);
  });
});

describe('sqlite store persistence', () => {
  it('keeps entries after the store is reopened', async () => {
    const path = freshPath();
    const c = clock();
    await createSqliteCacheStore({ path, now: c.now }).set('k', { v: 1 }, 10_000);
    const reopened = createSqliteCacheStore({ path, now: c.now });
    expect(await reopened.get('k')).toEqual({ v: 1 });
  });

  it('still expires entries after a reopen', async () => {
    const path = freshPath();
    const c = clock();
    await createSqliteCacheStore({ path, now: c.now }).set('k', 1, 1000);
    c.advance(1001);
    expect(await createSqliteCacheStore({ path, now: c.now }).get('k')).toBeUndefined();
  });

  it('creates missing parent directories', async () => {
    const path = join(dir, 'nested', 'deeper', 'cache.db');
    const store = createSqliteCacheStore({ path });
    await store.set('k', 1, 1000);
    expect(await store.get('k')).toBe(1);
  });

  it('survives keys with quotes (parameters are bound, not concatenated)', async () => {
    const store = createSqliteCacheStore({ path: freshPath() });
    const key = "x'; DROP TABLE cache; --";
    await store.set(key, 1, 1000);
    expect(await store.get(key)).toBe(1);
    await store.set('after', 2, 1000);
    expect(await store.get('after')).toBe(2);
  });
});

describe('createCacheStore', () => {
  it('uses a working in-memory store without a path', async () => {
    const store = createCacheStore(null);
    await store.set('k', 1, 1000);
    expect(await store.get('k')).toBe(1);
  });

  it('uses SQLite when a path is given (data survives a second store)', async () => {
    const path = freshPath();
    await createCacheStore(path).set('k', 'persisted', 60_000);
    expect(await createCacheStore(path).get('k')).toBe('persisted');
  });

  it('passes the clock through', async () => {
    let time = 0;
    const store = createCacheStore(null, () => time);
    await store.set('k', 1, 10);
    time = 11;
    expect(await store.get('k')).toBeUndefined();
  });
});
