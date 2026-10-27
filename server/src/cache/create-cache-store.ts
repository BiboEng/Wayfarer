import type { CacheStore, Clock } from './cache-store';
import { createMemoryCacheStore } from './memory-cache-store';
import { createSqliteCacheStore } from './sqlite-cache-store';

/** SQLite when a cache path is configured, otherwise in-memory. */
export function createCacheStore(cachePath: string | null, now?: Clock): CacheStore {
  return cachePath ? createSqliteCacheStore({ path: cachePath, now }) : createMemoryCacheStore({ now });
}
