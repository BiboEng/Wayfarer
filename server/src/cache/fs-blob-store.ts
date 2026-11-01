import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BLOB_MAX_AGE_MS, isValidBlobKey, type BlobStore } from './blob-store';
import type { Clock } from './cache-store';

export interface FsBlobOptions {
  dir: string;
  maxAgeMs?: number;
  now?: Clock;
}

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const EXTENSION = '.mp3';

/** Audio files in a directory (on Railway, the persistent volume). Files older than maxAgeMs are deleted on open and every few hours. */
export function createFsBlobStore(options: FsBlobOptions): BlobStore & { cleanup(): Promise<void> } {
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? BLOB_MAX_AGE_MS;
  mkdirSync(options.dir, { recursive: true });

  const pathFor = (key: string): string => {
    if (!isValidBlobKey(key)) throw new Error('Invalid blob key.');
    return join(options.dir, key + EXTENSION);
  };

  async function cleanup(): Promise<void> {
    for (const name of await readdir(options.dir)) {
      if (!name.endsWith(EXTENSION) && !name.endsWith('.tmp')) continue;
      const file = join(options.dir, name);
      try {
        const info = await stat(file);
        if (now() - info.mtimeMs > maxAgeMs) await unlink(file);
      } catch {
        // Already gone or unreadable: nothing to clean.
      }
    }
  }

  void cleanup().catch(() => undefined);
  const timer = setInterval(() => void cleanup().catch(() => undefined), CLEANUP_INTERVAL_MS);
  timer.unref();

  return {
    cleanup,
    close: () => clearInterval(timer),
    async has(key) {
      if (!isValidBlobKey(key)) return false;
      try {
        await stat(pathFor(key));
        return true;
      } catch {
        return false;
      }
    },
    async get(key) {
      if (!isValidBlobKey(key)) return undefined;
      try {
        return await readFile(pathFor(key));
      } catch {
        return undefined;
      }
    },
    async put(key, data) {
      const target = pathFor(key);
      const temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, data);
      await rename(temp, target); // atomic: readers never see a half-written file
    },
  };
}
