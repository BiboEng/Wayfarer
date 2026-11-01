import { ENDPOINTS } from '@shared/api/endpoints';
import type { NarrationRequest, NarrationResponse, NarrationSource } from '@shared/api/narration';
import type { Landmark } from '@shared/landmarks/landmark';
import { targetWords } from '@shared/narration/length';
import type { VoiceId } from '@shared/narration/options';
import type { TTSProvider } from '@shared/narration/tts-provider';
import { AUDIO_CONTENT_TYPE, type BlobStore } from '../cache/blob-store';
import type { CacheStore } from '../cache/cache-store';
import type { DailyCaps } from '../costs/daily-caps';
import { UpstreamError } from '../http/upstream-error';
import { audioBlobKey, narrationCacheKey } from './cache-key';
import { cleanNarration } from './clean-text';
import { NarrationError } from './narration-error';
import type { LlmClient } from './openrouter-client';
import { buildNarrationMessages } from './prompt';
import { wikipediaFallbackText } from './wikipedia-fallback';

export const TEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Fallback text is kept briefly so the AI is tried again soon. */
export const FALLBACK_TTL_MS = 30 * 60 * 1000;
/** Voice name used when the server has no TTS voices. */
export const DEVICE_VOICE = 'device';

export interface NarratorDeps {
  cache: CacheStore;
  blobs: BlobStore;
  landmarks: { getById(id: string, signal?: AbortSignal): Promise<Landmark | null> };
  llm: LlmClient;
  tts: TTSProvider;
  caps: DailyCaps;
  log?: (message: string) => void;
}

export interface Narrator {
  /**
   * Paid upstream calls are never cancelled by the client going away: they finish
   * under their own timeouts and the result is cached. The signal is accepted for
   * the route's convenience but not used for paid work.
   */
  narrate(request: NarrationRequest, signal?: AbortSignal): Promise<NarrationResponse>;
}

/** What is stored in the CacheStore. Audio lives in the BlobStore, found by hash of text + voice. */
interface CachedText {
  text: string;
  source: NarrationSource;
}

/** Room for the model's words, with headroom (about 1.4 tokens per word, plus slack). */
const maxTokensFor = (words: number): number => Math.ceil(words * 2.5) + 50;

/** A 4xx from the voice service came back before any audio was made, so nothing was billed. */
function failedBeforeSpending(err: unknown): boolean {
  return err instanceof UpstreamError && err.status !== undefined && err.status >= 400 && err.status < 500;
}

export function createNarrator(deps: NarratorDeps): Narrator {
  const log = deps.log ?? ((message: string) => console.log(message));
  const hasVoices = deps.tts.voices.length > 0;
  // Single flight: concurrent requests for the same missing item share one paid call.
  const textFlights = new Map<string, Promise<CachedText>>();
  const audioFlights = new Map<string, Promise<boolean>>();

  function singleFlight<T>(flights: Map<string, Promise<T>>, key: string, start: () => Promise<T>): Promise<T> {
    const running = flights.get(key);
    if (running) return running;
    const promise = start().finally(() => flights.delete(key));
    flights.set(key, promise);
    return promise;
  }

  function resolveVoice(requested: VoiceId | undefined): VoiceId {
    if (!hasVoices) return DEVICE_VOICE;
    if (requested === undefined) return deps.tts.voices[0].id;
    if (deps.tts.voices.some((v) => v.id === requested)) return requested;
    // A voice saved in the app's Settings can outlive a change to ELEVENLABS_VOICES: a tour should still get a story.
    log('[narration] Unknown voice requested; using the default voice.'); // the id is client input, so it is not logged
    return deps.tts.voices[0].id;
  }

  /** Makes the audio file within the daily cap. Returns false for text-only. */
  async function makeAudio(blobKey: string, text: string, voice: VoiceId): Promise<boolean> {
    const day = await deps.caps.tryReserve('tts', text.length);
    if (day === null) return false;
    let audio;
    try {
      audio = await deps.tts.synthesize(text, voice);
    } catch (err) {
      // Keep the reservation unless the call certainly never produced audio: a timeout or 5xx may still be billed.
      if (failedBeforeSpending(err)) await deps.caps.release('tts', text.length, day);
      log(`[narration] TTS failed (${err instanceof Error ? err.name : 'error'}); returning text only.`);
      return false;
    }
    if (!audio) {
      await deps.caps.release('tts', text.length, day);
      return false;
    }
    try {
      await deps.blobs.put(blobKey, audio.data); // audio was paid for: the reservation stays
    } catch {
      log('[narration] Could not store audio; returning text only.');
      return false;
    }
    return true;
  }

  async function getAudioKey(text: string, voice: VoiceId): Promise<string | null> {
    if (!hasVoices) return null;
    const blobKey = audioBlobKey(text, voice);
    if (await deps.blobs.has(blobKey)) return blobKey;
    const ok = await singleFlight(audioFlights, blobKey, async () =>
      (await deps.blobs.has(blobKey)) ? true : makeAudio(blobKey, text, voice),
    );
    return ok ? blobKey : null;
  }

  /** Writes the story with the AI within the daily cap, or falls back to the Wikipedia intro. */
  async function makeText(landmark: Landmark, extract: string, request: NarrationRequest): Promise<CachedText> {
    const words = targetWords(request.travelMode, request.length);
    const fallbackText = wikipediaFallbackText(extract, words);
    const fallback: CachedText = { text: fallbackText, source: 'wikipedia' };
    if ((await deps.caps.tryReserve('llm', 1)) === null) return fallback;
    try {
      const result = await deps.llm.complete(
        buildNarrationMessages({ landmark, travelMode: request.travelMode, length: request.length }),
        maxTokensFor(words),
      );
      const text = cleanNarration(result.text, words);
      if (text === '') throw new Error('empty narration');
      const cost = result.costUsd === undefined ? 'n/a' : `$${result.costUsd}`;
      log(`[narration] ai model=${result.model} in=${result.promptTokens ?? '?'} out=${result.completionTokens ?? '?'} cost=${cost}`);
      return { text, source: 'ai' };
    } catch (err) {
      log(`[narration] AI failed (${err instanceof Error ? err.name : 'error'}); using the Wikipedia intro.`);
      return fallback;
    }
  }

  async function loadText(request: NarrationRequest, cacheKey: string): Promise<CachedText> {
    const cached = await deps.cache.get<CachedText>(cacheKey);
    if (cached) return cached;

    const landmark = await deps.landmarks.getById(request.landmarkId);
    if (!landmark) throw new NarrationError('NOT_FOUND', 'Landmark not found.');
    const extract = landmark.wikipedia?.extract.trim() ?? '';
    if (extract === '') throw new NarrationError('NOT_NARRATABLE', 'No article text to base a story on.');

    const story = await makeText(landmark, extract, request);
    if (story.text === '') throw new NarrationError('NOT_NARRATABLE', 'No article text to base a story on.');
    // Cache right away, before any audio work, so paid text is never lost.
    await deps.cache.set<CachedText>(cacheKey, story, story.source === 'ai' ? TEXT_TTL_MS : FALLBACK_TTL_MS);
    return story;
  }

  return {
    async narrate(request) {
      const voice = resolveVoice(request.voice);
      const cacheKey = narrationCacheKey({
        landmarkId: request.landmarkId,
        travelMode: request.travelMode,
        length: request.length,
      });
      const story = await singleFlight(textFlights, cacheKey, () => loadText(request, cacheKey));
      // Audio is retried on every request while it is missing (cap reached, TTS failed, file cleaned up).
      const audioKey = await getAudioKey(story.text, voice);
      return {
        landmarkId: request.landmarkId,
        text: story.text,
        source: story.source,
        audio: audioKey ? { url: `${ENDPOINTS.narrationAudio}/${audioKey}`, contentType: AUDIO_CONTENT_TYPE } : null,
      };
    },
  };
}
