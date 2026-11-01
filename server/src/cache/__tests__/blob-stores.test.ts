import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AUDIO_CONTENT_TYPE, BLOB_MAX_AGE_MS, isValidBlobKey, type BlobStore } from '../blob-store';
import { createBlobStore } from '../create-blob-store';
import { createFsBlobStore } from '../fs-blob-store';
import { createMemoryBlobStore } from '../memory-blob-store';

const keyOf = (n: number) => n.toString(16).padStart(64, '0');
const DATA = new Uint8Array([1, 2, 3, 4]);

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'wayfarer-blobs-'));
});
afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // best effort on Windows
  }
});

let counter = 0;
const freshDir = () => join(root, `dir-${(counter += 1)}`);
const stores: Array<{ close?: () => void }> = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close?.();
});

describe('isValidBlobKey', () => {
  it('accepts exactly 64 lowercase hex characters', () => {
    expect(isValidBlobKey('a'.repeat(64))).toBe(true);
    expect(isValidBlobKey(keyOf(255))).toBe(true);
  });

  it.each([
    '',
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'g'.repeat(64),
    `${'a'.repeat(63)}/`,
    `../${'a'.repeat(61)}`,
    `${'a'.repeat(64)}\n`,
    `${'a'.repeat(60)}.mp3`,
    'a'.repeat(32) + '\\' + 'a'.repeat(31),
  ])('rejects %j', (key) => {
    expect(isValidBlobKey(key)).toBe(false);
  });

  it('declares audio as audio/mpeg and keeps files for 30 days', () => {
    expect(AUDIO_CONTENT_TYPE).toBe('audio/mpeg');
    expect(BLOB_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

function describeContract(name: string, make: () => BlobStore) {
  describe(`${name} (contract)`, () => {
    it('has nothing for an unknown key', async () => {
      const store = make();
      expect(await store.has(keyOf(1))).toBe(false);
      expect(await store.get(keyOf(1))).toBeUndefined();
    });

    it('stores and returns bytes', async () => {
      const store = make();
      await store.put(keyOf(1), DATA);
      expect(await store.has(keyOf(1))).toBe(true);
      expect(Array.from((await store.get(keyOf(1))) ?? [])).toEqual([1, 2, 3, 4]);
    });

    it('overwrites an existing key', async () => {
      const store = make();
      await store.put(keyOf(1), DATA);
      await store.put(keyOf(1), new Uint8Array([9]));
      expect(Array.from((await store.get(keyOf(1))) ?? [])).toEqual([9]);
    });

    it('keeps keys apart', async () => {
      const store = make();
      await store.put(keyOf(1), new Uint8Array([1]));
      await store.put(keyOf(2), new Uint8Array([2]));
      expect(Array.from((await store.get(keyOf(2))) ?? [])).toEqual([2]);
    });

    it('rejects invalid keys on put', async () => {
      const store = make();
      for (const key of ['', 'short', '../../etc/passwd', `${'a'.repeat(63)}/`, 'A'.repeat(64)]) {
        await expect(store.put(key, DATA)).rejects.toThrow();
      }
    });

    it('says no (never throws) for invalid keys on has and get', async () => {
      const store = make();
      expect(await store.has('../../etc/passwd')).toBe(false);
      expect(await store.get('../../etc/passwd')).toBeUndefined();
    });
  });
}

describeContract('memory blob store', () => createMemoryBlobStore());
describeContract('fs blob store', () => {
  const store = createFsBlobStore({ dir: freshDir() });
  stores.push(store);
  return store;
});

describe('memory blob store', () => {
  it('evicts the oldest entry when full', async () => {
    const store = createMemoryBlobStore(2);
    await store.put(keyOf(1), DATA);
    await store.put(keyOf(2), DATA);
    await store.put(keyOf(3), DATA);
    expect(await store.has(keyOf(1))).toBe(false);
    expect(await store.has(keyOf(2))).toBe(true);
    expect(await store.has(keyOf(3))).toBe(true);
  });

  it('counts a rewritten key as newest', async () => {
    const store = createMemoryBlobStore(2);
    await store.put(keyOf(1), DATA);
    await store.put(keyOf(2), DATA);
    await store.put(keyOf(1), DATA);
    await store.put(keyOf(3), DATA);
    expect(await store.has(keyOf(2))).toBe(false);
    expect(await store.has(keyOf(1))).toBe(true);
  });
});

describe('fs blob store', () => {
  it('creates the directory (including parents)', async () => {
    const dir = join(freshDir(), 'nested', 'audio');
    const store = createFsBlobStore({ dir });
    stores.push(store);
    await store.put(keyOf(1), DATA);
    expect(existsSync(join(dir, `${keyOf(1)}.mp3`))).toBe(true);
  });

  it('writes <key>.mp3 and leaves no temp files behind', async () => {
    const dir = freshDir();
    const store = createFsBlobStore({ dir });
    stores.push(store);
    await store.put(keyOf(7), DATA);
    expect(readdirSync(dir)).toEqual([`${keyOf(7)}.mp3`]);
  });

  it('persists across reopen', async () => {
    const dir = freshDir();
    const first = createFsBlobStore({ dir });
    stores.push(first);
    await first.put(keyOf(1), DATA);
    const second = createFsBlobStore({ dir });
    stores.push(second);
    expect(await second.has(keyOf(1))).toBe(true);
  });

  it('never touches files outside its directory for path tricks', async () => {
    const dir = freshDir();
    const store = createFsBlobStore({ dir });
    stores.push(store);
    const outside = join(dir, '..', 'outside.mp3');
    writeFileSync(outside, 'secret');
    expect(await store.get('../outside')).toBeUndefined();
    await expect(store.put('../outside', DATA)).rejects.toThrow();
    expect(existsSync(outside)).toBe(true);
  });

  // Known issue on Windows: renaming onto a file that another writer is replacing fails with EPERM.
  // Production runs on Linux (Railway), where rename is atomic, and the narrator single-flights same-key writes.
  it.skipIf(process.platform === 'win32')('concurrent writes of the same key all succeed and leave one clean file', async () => {
    const dir = freshDir();
    const store = createFsBlobStore({ dir });
    stores.push(store);
    const data = new Uint8Array([5, 6, 7]);
    await Promise.all(Array.from({ length: 25 }, () => store.put(keyOf(9), data)));
    expect(readdirSync(dir)).toEqual([`${keyOf(9)}.mp3`]);
    expect(Array.from((await store.get(keyOf(9))) ?? [])).toEqual([5, 6, 7]);
  });

  it('concurrent writes of different keys do not interfere', async () => {
    const dir = freshDir();
    const store = createFsBlobStore({ dir });
    stores.push(store);
    await Promise.all(Array.from({ length: 10 }, (_, i) => store.put(keyOf(i + 1), new Uint8Array([i]))));
    expect(readdirSync(dir)).toHaveLength(10);
    expect(Array.from((await store.get(keyOf(4))) ?? [])).toEqual([3]);
  });

  describe('cleanup of old files', () => {
    const days = (n: number) => n * 24 * 60 * 60 * 1000;

    function seed(dir: string, name: string, ageMs: number, now: number) {
      const file = join(dir, name);
      writeFileSync(file, 'x');
      const t = (now - ageMs) / 1000;
      utimesSync(file, t, t);
    }

    it('deletes files older than the max age and keeps newer ones', async () => {
      const dir = freshDir();
      const now = Date.now();
      const store = createFsBlobStore({ dir, now: () => now });
      stores.push(store);
      seed(dir, `${keyOf(1)}.mp3`, days(31), now);
      seed(dir, `${keyOf(2)}.mp3`, days(29), now);
      await store.cleanup();
      expect(readdirSync(dir).sort()).toEqual([`${keyOf(2)}.mp3`]);
    });

    it('uses a custom max age and the injected clock', async () => {
      const dir = freshDir();
      const now = Date.now();
      let time = now;
      const store = createFsBlobStore({ dir, maxAgeMs: 1000, now: () => time });
      stores.push(store);
      await store.put(keyOf(1), DATA);
      await store.cleanup();
      expect(await store.has(keyOf(1))).toBe(true);
      time = now + 5000;
      await store.cleanup();
      expect(await store.has(keyOf(1))).toBe(false);
    });

    it('also removes stale leftover .tmp files', async () => {
      const dir = freshDir();
      const now = Date.now();
      const store = createFsBlobStore({ dir, now: () => now });
      stores.push(store);
      seed(dir, `${keyOf(1)}.mp3.123.tmp`, days(40), now);
      await store.cleanup();
      expect(readdirSync(dir)).toEqual([]);
    });

    it('leaves unrelated files alone', async () => {
      const dir = freshDir();
      const now = Date.now();
      const store = createFsBlobStore({ dir, now: () => now });
      stores.push(store);
      seed(dir, 'notes.txt', days(400), now);
      await store.cleanup();
      expect(readdirSync(dir)).toEqual(['notes.txt']);
    });

    it('cleans up on open', async () => {
      const dir = freshDir();
      const now = Date.now();
      createFsBlobStore({ dir }).close?.(); // create the directory
      seed(dir, `${keyOf(1)}.mp3`, days(60), now);
      const store = createFsBlobStore({ dir, now: () => now });
      stores.push(store);
      await vi.waitFor(() => expect(readdirSync(dir)).toEqual([]));
    });

    it('cleans up again on the 6 hour timer, and close() stops it', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      try {
        const dir = freshDir();
        const now = Date.now();
        const store = createFsBlobStore({ dir, now: () => now });
        seed(dir, `${keyOf(1)}.mp3`, days(60), now);
        expect(vi.getTimerCount()).toBe(1);
        await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
        await vi.waitFor(() => expect(readdirSync(dir)).toEqual([]));
        store.close?.();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('createBlobStore', () => {
  it('uses memory without a directory', async () => {
    const store = createBlobStore(null);
    await store.put(keyOf(1), DATA);
    expect(await store.has(keyOf(1))).toBe(true);
  });

  it('uses files when a directory is given', async () => {
    const dir = freshDir();
    const store = createBlobStore(dir);
    stores.push(store);
    await store.put(keyOf(1), DATA);
    expect(existsSync(join(dir, `${keyOf(1)}.mp3`))).toBe(true);
  });
});
