import { isValidBlobKey, type BlobStore } from './blob-store';

/** In-process audio store for tests and for running without AUDIO_DIR. Evicts the oldest entry when full. */
export function createMemoryBlobStore(maxEntries = 100): BlobStore {
  const blobs = new Map<string, Uint8Array>();
  return {
    has: (key) => Promise.resolve(blobs.has(key)),
    get: (key) => Promise.resolve(blobs.get(key)),
    put(key, data) {
      if (!isValidBlobKey(key)) return Promise.reject(new Error('Invalid blob key.'));
      blobs.delete(key);
      blobs.set(key, data);
      while (blobs.size > maxEntries) {
        const oldest = blobs.keys().next();
        if (oldest.done) break;
        blobs.delete(oldest.value);
      }
      return Promise.resolve();
    },
  };
}
