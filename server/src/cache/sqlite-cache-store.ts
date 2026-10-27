import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CacheStore, Clock } from './cache-store';

export interface SqliteCacheOptions {
  path: string;
  now?: Clock;
}

interface Row {
  value: string;
  expires_at: number;
}

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

/** Persistent cache backed by Node's built-in SQLite. Expired rows are purged on open, hourly, and on read. */
export function createSqliteCacheStore(options: SqliteCacheOptions): CacheStore {
  const now = options.now ?? Date.now;
  if (options.path !== ':memory:') mkdirSync(dirname(options.path), { recursive: true });
  const db = new DatabaseSync(options.path);
  db.exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL)');
  const selectStmt = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?');
  const upsertStmt = db.prepare('INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)');
  const deleteStmt = db.prepare('DELETE FROM cache WHERE key = ?');
  db.exec('CREATE INDEX IF NOT EXISTS cache_expires_at ON cache (expires_at)');
  const purgeStmt = db.prepare('DELETE FROM cache WHERE expires_at <= ?');
  const purge = (): void => {
    purgeStmt.run(now());
  };
  purge();
  const timer = setInterval(purge, PURGE_INTERVAL_MS);
  timer.unref();

  return {
    close(): void {
      clearInterval(timer);
      db.close();
    },
    get<T>(key: string): Promise<T | undefined> {
      const row = selectStmt.get(key) as Row | undefined;
      if (!row) return Promise.resolve(undefined);
      if (row.expires_at <= now()) {
        deleteStmt.run(key);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(JSON.parse(row.value) as T);
    },
    set<T>(key: string, value: T, ttlMs: number): Promise<void> {
      upsertStmt.run(key, JSON.stringify(value), now() + ttlMs);
      return Promise.resolve();
    },
    delete(key: string): Promise<void> {
      deleteStmt.run(key);
      return Promise.resolve();
    },
  };
}
