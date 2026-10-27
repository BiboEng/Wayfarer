import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteCacheStore } from '../sqlite-cache-store';

const HOUR_MS = 60 * 60 * 1000;
let dir: string;
let counter = 0;
const freshPath = () => join(dir, `purge-${(counter += 1)}.db`);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wayfarer-purge-'));
});
afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort on Windows
  }
});

/** Reads rows straight from the file, bypassing the store's own expiry check. */
function rowKeys(path: string): string[] {
  const db = new DatabaseSync(path);
  try {
    return (db.prepare('SELECT key FROM cache ORDER BY key').all() as Array<{ key: string }>).map((r) => r.key);
  } finally {
    db.close();
  }
}

describe('sqlite store purge', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes expired rows when the store is opened', async () => {
    const path = freshPath();
    let time = 1_000;
    const first = createSqliteCacheStore({ path, now: () => time });
    await first.set('old', 1, 100);
    await first.set('fresh', 2, 1_000_000);
    first.close?.();
    expect(rowKeys(path)).toEqual(['fresh', 'old']);

    time += 500;
    const second = createSqliteCacheStore({ path, now: () => time });
    second.close?.();
    expect(rowKeys(path)).toEqual(['fresh']);
  });

  it('purges expired rows on the hourly timer, without any reads', async () => {
    const path = freshPath();
    let time = 0;
    const store = createSqliteCacheStore({ path, now: () => time });
    await store.set('short', 1, 1_000);
    await store.set('long', 2, 10 * HOUR_MS);
    expect(rowKeys(path)).toEqual(['long', 'short']);

    time = 2_000;
    await vi.advanceTimersByTimeAsync(HOUR_MS - 1);
    expect(rowKeys(path)).toEqual(['long', 'short']); // timer has not fired yet
    await vi.advanceTimersByTimeAsync(1);
    expect(rowKeys(path)).toEqual(['long']);

    time = 11 * HOUR_MS;
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(rowKeys(path)).toEqual([]);
    store.close?.();
  });

  it('keeps rows that expire exactly at the purge time out (expires_at <= now is purged)', async () => {
    const path = freshPath();
    let time = 0;
    const store = createSqliteCacheStore({ path, now: () => time });
    await store.set('edge', 1, 500);
    time = 500;
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(rowKeys(path)).toEqual([]);
    store.close?.();
  });

  it('creates the expires_at index', () => {
    const path = freshPath();
    createSqliteCacheStore({ path }).close?.();
    const db = new DatabaseSync(path);
    try {
      const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'").all() as Array<{
        name: string;
        tbl_name: string;
      }>;
      expect(indexes.some((i) => i.tbl_name === 'cache' && i.name.includes('expires'))).toBe(true);
    } finally {
      db.close();
    }
  });

  it('close() clears the timer', () => {
    const baseline = vi.getTimerCount();
    const store = createSqliteCacheStore({ path: freshPath() });
    expect(vi.getTimerCount()).toBe(baseline + 1);
    store.close?.();
    expect(vi.getTimerCount()).toBe(baseline);
  });

  it('close() closes the database, so later use fails', async () => {
    const store = createSqliteCacheStore({ path: freshPath() });
    await store.set('k', 1, 1000);
    store.close?.();
    await expect(Promise.resolve().then(() => store.get('k'))).rejects.toThrow();
  });

  it('close() frees the file so it can be reopened and read', async () => {
    const path = freshPath();
    const store = createSqliteCacheStore({ path });
    await store.set('k', 'v', 60_000);
    store.close?.();
    const reopened = createSqliteCacheStore({ path });
    expect(await reopened.get('k')).toBe('v');
    reopened.close?.();
  });
});
