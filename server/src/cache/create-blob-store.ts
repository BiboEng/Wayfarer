import type { BlobStore } from './blob-store';
import { createFsBlobStore } from './fs-blob-store';
import { createMemoryBlobStore } from './memory-blob-store';

/** Files in audioDir when configured, otherwise in memory. */
export function createBlobStore(audioDir: string | null): BlobStore {
  return audioDir ? createFsBlobStore({ dir: audioDir }) : createMemoryBlobStore();
}
