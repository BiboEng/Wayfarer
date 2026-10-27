import type { CacheStore, Clock } from './cache-store';

interface Entry {
  json: string;
  expiresAt: number;
}

export interface MemoryCacheOptions {
  maxEntries?: number;
  now?: Clock;
}

/** In-process cache. Evicts the oldest-inserted entry when full. Values are stored as JSON so they behave like the SQLite store. */
export function createMemoryCacheStore(options: MemoryCacheOptions = {}): CacheStore {
  const maxEntries = options.maxEntries ?? 1000;
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry>();

  return {
    get<T>(key: string): Promise<T | undefined> {
      const entry = entries.get(key);
      if (!entry) return Promise.resolve(undefined);
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(JSON.parse(entry.json) as T);
    },
    set<T>(key: string, value: T, ttlMs: number): Promise<void> {
      entries.delete(key); // re-insert so it counts as newest
      entries.set(key, { json: JSON.stringify(value), expiresAt: now() + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
      return Promise.resolve();
    },
    delete(key: string): Promise<void> {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}
