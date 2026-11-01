/** Audio is always MP3 (both TTS providers are asked for it). */
export const AUDIO_CONTENT_TYPE = 'audio/mpeg';

/** Audio files are kept as long as the cached narration text (30 days). */
export const BLOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Keys are 64 lowercase hex characters (a SHA-256). Anything else is rejected, which rules out path tricks. */
const BLOB_KEY = /^[a-f0-9]{64}$/;

export function isValidBlobKey(key: string): boolean {
  return BLOB_KEY.test(key);
}

/** Stores audio bytes by key. The CacheStore only holds JSON, so audio lives here. */
export interface BlobStore {
  has(key: string): Promise<boolean>;
  get(key: string): Promise<Uint8Array | undefined>;
  /** Throws if the key is not a valid blob key. */
  put(key: string, data: Uint8Array): Promise<void>;
  close?(): void;
}
