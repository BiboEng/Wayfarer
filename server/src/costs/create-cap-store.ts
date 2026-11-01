import type { CacheStore, Clock } from '../cache/cache-store';
import { createMemoryCacheStore } from '../cache/memory-cache-store';

/**
 * Store for the daily cap counters. SQLite never evicts live rows, so the shared
 * cache is fine there. The shared memory cache evicts its oldest entries when
 * landmark lookups fill it, which would reset the counters, so memory mode gets
 * a store of its own that only the caps write to (a few keys a day).
 */
export function createCapStore(cachePath: string | null, shared: CacheStore, now?: Clock): CacheStore {
  return cachePath ? shared : createMemoryCacheStore({ now });
}
