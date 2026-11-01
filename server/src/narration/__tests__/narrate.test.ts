import { describe, expect, it, vi } from 'vitest';
import type { Landmark } from '@shared/landmarks/landmark';
import type { SynthesizedAudio, TTSProvider } from '@shared/narration/tts-provider';
import type { NarrationRequest } from '@shared/api/narration';
import { AUDIO_CONTENT_TYPE, isValidBlobKey } from '../../cache/blob-store';
import type { CacheStore } from '../../cache/cache-store';
import { createMemoryBlobStore } from '../../cache/memory-blob-store';
import { createMemoryCacheStore } from '../../cache/memory-cache-store';
import { createDailyCaps, type DailyCaps } from '../../costs/daily-caps';
import { UpstreamError } from '../../http/upstream-error';
import { wikiLandmark } from '../../landmarks/__fixtures__/builders';
import { FALLBACK_TTL_MS, TEXT_TTL_MS, createNarrator } from '../narrate';
import { NarrationError } from '../narration-error';
import type { LlmClient, LlmResult } from '../openrouter-client';
import { narrationCacheKey } from '../cache-key';

const EXTRACT =
  'The Galata Tower is a medieval stone tower in Istanbul. It was built in 1348 as part of the Genoese colony. ' +
  'It was once the tallest building in the city. Today it is a museum with a viewing gallery.';
const AI_TEXT = 'Long ago, a tower rose above the harbour. It was built in 1348.';
const VOICES = [
  { id: 'voiceA', label: 'Warm' },
  { id: 'voiceB', label: 'Calm' },
];
const REQUEST: NarrationRequest = { landmarkId: 'wiki:1', length: 'medium', travelMode: 'walking' };

const TEXT_KEY = narrationCacheKey({ landmarkId: 'wiki:1', travelMode: 'walking', length: 'medium' });

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Caps that always grant and record what was reserved and released. */
function recordingCaps(grantTts = true) {
  const events: string[] = [];
  const caps: DailyCaps = {
    tryReserve: (kind, amount) => {
      const ok = kind === 'llm' || grantTts;
      events.push(`${ok ? 'reserve' : 'refuse'}:${kind}:${amount}`);
      return Promise.resolve(ok ? '2026-10-27' : null);
    },
    release: (kind, amount, day) => {
      events.push(`release:${kind}:${amount}:${day}`);
      return Promise.resolve();
    },
  };
  return { caps, events };
}

function makeLandmark(extract: string | null = EXTRACT): Landmark {
  const base = wikiLandmark({ pageId: 1, name: 'Galata Tower' });
  return { ...base, wikipedia: extract === null ? undefined : base.wikipedia && { ...base.wikipedia, extract } };
}

interface Options {
  landmark?: Landmark | null;
  voices?: typeof VOICES;
  llmCap?: number;
  ttsCap?: number;
  llm?: LlmClient['complete'];
  synthesize?: TTSProvider['synthesize'];
  now?: () => number;
  cache?: CacheStore;
  getByIdError?: Error;
  caps?: DailyCaps;
}

function setup(options: Options = {}) {
  const now = options.now ?? (() => 1_000_000);
  const cache = options.cache ?? createMemoryCacheStore({ now });
  const blobs = createMemoryBlobStore();
  const logs: string[] = [];
  const getById = vi.fn((id: string, signal?: AbortSignal) => {
    void id;
    void signal;
    if (options.getByIdError) return Promise.reject(options.getByIdError);
    return Promise.resolve(options.landmark === undefined ? makeLandmark() : options.landmark);
  });
  const complete = vi.fn(
    options.llm ??
      ((): Promise<LlmResult> =>
        Promise.resolve({ text: AI_TEXT, model: 'test/model', promptTokens: 100, completionTokens: 20, costUsd: 0.0002 })),
  );
  const synthesize = vi.fn(
    options.synthesize ??
      ((): Promise<SynthesizedAudio | null> =>
        Promise.resolve({ contentType: 'audio/mpeg', data: new Uint8Array([1, 2, 3]) })),
  );
  const tts: TTSProvider = { name: 'elevenlabs', voices: options.voices ?? [], synthesize };
  const caps = options.caps ?? createDailyCaps({
    cache: createMemoryCacheStore({ now }),
    llmCalls: options.llmCap ?? 100,
    ttsChars: options.ttsCap ?? 100_000,
    now,
    log: () => undefined,
  });
  const narrator = createNarrator({ cache, blobs, landmarks: { getById }, llm: { complete }, tts, caps, log: (m) => logs.push(m) });
  return { narrator, cache, blobs, getById, complete, synthesize, caps, logs };
}

describe('createNarrator: text-only server (no TTS voices)', () => {
  it('writes the story with the AI and returns it without audio', async () => {
    const { narrator, complete, synthesize } = setup();
    const result = await narrator.narrate(REQUEST);
    expect(result).toEqual({ landmarkId: 'wiki:1', text: AI_TEXT, source: 'ai', audio: null });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('builds the prompt from the reloaded landmark, not from anything the client sent', async () => {
    const { narrator, complete, getById } = setup();
    await narrator.narrate(REQUEST);
    expect(getById.mock.calls[0][0]).toBe('wiki:1');
    const messages = complete.mock.calls[0][0];
    expect(messages[1].content).toContain('The Galata Tower is a medieval stone tower');
  });

  it('asks for enough tokens for the target and no more than a bounded amount', async () => {
    const { narrator, complete } = setup();
    await narrator.narrate({ ...REQUEST, length: 'long', travelMode: 'walking' });
    const maxTokens = complete.mock.calls[0][1];
    expect(maxTokens).toBeGreaterThan(250 * 1.4);
    expect(maxTokens).toBeLessThan(2000);
  });

  it('cleans markdown out of the model reply', async () => {
    const { narrator } = setup({ llm: () => Promise.resolve({ text: '# Title\n**Bold** story.', model: 'm' }) });
    expect((await narrator.narrate(REQUEST)).text).toBe('Title Bold story.');
  });

  it('logs model and cost but never the story text', async () => {
    const { narrator, logs } = setup();
    await narrator.narrate(REQUEST);
    expect(logs.join(' ')).toContain('model=test/model');
    expect(logs.join(' ')).toContain('cost=$0.0002');
    expect(logs.join(' ')).not.toContain(AI_TEXT);
  });

  it('caches the AI text for 30 days under the voice-free text key', async () => {
    let time = 1_000_000;
    const { narrator, cache } = setup({ now: () => time });
    await narrator.narrate(REQUEST);
    expect(TEXT_KEY).not.toMatch(/device|voice/);
    expect(await cache.get(TEXT_KEY)).toEqual({ text: AI_TEXT, source: 'ai' });
    time += TEXT_TTL_MS - 1;
    expect(await cache.get(TEXT_KEY)).toBeDefined();
    time += 2;
    expect(await cache.get(TEXT_KEY)).toBeUndefined();
  });

  it('ignores a requested voice when the server has no voices', async () => {
    const { narrator } = setup();
    await expect(narrator.narrate({ ...REQUEST, voice: 'anything' })).resolves.toMatchObject({ source: 'ai' });
  });
});

describe('createNarrator: cache hits', () => {
  it('makes zero upstream calls on the second identical request', async () => {
    const { narrator, getById, complete, synthesize } = setup({ voices: VOICES });
    const first = await narrator.narrate(REQUEST);
    const upstream = () => getById.mock.calls.length + complete.mock.calls.length + synthesize.mock.calls.length;
    const before = upstream();
    const second = await narrator.narrate(REQUEST);
    expect(upstream()).toBe(before);
    expect(second).toEqual(first);
  });

  it('does not touch the daily caps on a full cache hit', async () => {
    const { narrator, caps } = setup({ voices: VOICES });
    await narrator.narrate(REQUEST);
    const reserve = vi.spyOn(caps, 'tryReserve');
    await narrator.narrate(REQUEST);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('keeps separate text entries per travel mode, length and landmark', async () => {
    const { narrator, complete } = setup({ voices: VOICES });
    await narrator.narrate(REQUEST);
    await narrator.narrate({ ...REQUEST, travelMode: 'driving' });
    await narrator.narrate({ ...REQUEST, length: 'short' });
    await narrator.narrate({ ...REQUEST, landmarkId: 'wiki:2' });
    expect(complete).toHaveBeenCalledTimes(4);
  });

  it('treats an omitted voice as the first (default) voice', async () => {
    const { narrator, complete } = setup({ voices: VOICES });
    await narrator.narrate(REQUEST);
    await narrator.narrate({ ...REQUEST, voice: 'voiceA' });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe('createNarrator: errors before any paid call', () => {
  it('throws NOT_FOUND when the landmark is gone, without calling AI or TTS', async () => {
    const { narrator, complete, synthesize } = setup({ landmark: null, voices: VOICES });
    const error = await narrator.narrate(REQUEST).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NarrationError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(complete).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it.each([
    ['no article at all', null],
    ['an empty extract', ''],
    ['a blank extract', '   \n '],
  ])('throws NOT_NARRATABLE for %s, without spending anything', async (_name, extract) => {
    const { narrator, complete, synthesize, caps } = setup({ landmark: makeLandmark(extract), voices: VOICES });
    const reserve = vi.spyOn(caps, 'tryReserve');
    const error = await narrator.narrate(REQUEST).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'NarrationError', code: 'NOT_NARRATABLE', status: 422 });
    expect(complete).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });

  it('does not cache a NOT_NARRATABLE or NOT_FOUND answer', async () => {
    const { narrator, getById } = setup({ landmark: null });
    await narrator.narrate(REQUEST).catch(() => undefined);
    await narrator.narrate(REQUEST).catch(() => undefined);
    expect(getById).toHaveBeenCalledTimes(2);
  });

  it('throws BAD_REQUEST for an unknown voice when the server has voices, with no upstream calls', async () => {
    const { narrator, getById, complete, synthesize } = setup({ voices: VOICES });
    const error = await narrator.narrate({ ...REQUEST, voice: 'nope' }).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'NarrationError', code: 'BAD_REQUEST', status: 400 });
    expect(getById).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('lets upstream landmark failures through unchanged', async () => {
    const { narrator, complete } = setup({ getByIdError: new Error('landmark source down') });
    await expect(narrator.narrate(REQUEST)).rejects.toThrow('landmark source down');
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('createNarrator: AI cap and AI failure fall back to the Wikipedia intro', () => {
  it('uses the Wikipedia text when the daily AI cap is reached, without calling the AI', async () => {
    const { narrator, complete } = setup({ llmCap: 0 });
    const result = await narrator.narrate(REQUEST);
    expect(complete).not.toHaveBeenCalled();
    expect(result.source).toBe('wikipedia');
    expect(result.text).toContain('Galata Tower is a medieval stone tower');
    expect(result.text).not.toContain(AI_TEXT);
  });

  it('uses the Wikipedia text when the AI call fails', async () => {
    const { narrator, complete, logs } = setup({ llm: () => Promise.reject(new Error('boom sk-secret')) });
    const result = await narrator.narrate(REQUEST);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('wikipedia');
    expect(logs.join(' ')).not.toContain('sk-secret'); // only the error name is logged
  });

  it('uses the Wikipedia text when the model returns nothing usable', async () => {
    const { narrator } = setup({ llm: () => Promise.resolve({ text: '```x```', model: 'm' }) });
    expect((await narrator.narrate(REQUEST)).source).toBe('wikipedia');
  });

  it('caches fallback text for only 30 minutes, then tries the AI again', async () => {
    let time = 5_000_000;
    let allowAi = false;
    const { narrator, complete } = setup({
      now: () => time,
      llm: () => (allowAi ? Promise.resolve({ text: AI_TEXT, model: 'm' }) : Promise.reject(new Error('down'))),
    });
    const first = await narrator.narrate(REQUEST);
    expect(first.source).toBe('wikipedia');

    time += FALLBACK_TTL_MS - 1;
    expect((await narrator.narrate(REQUEST)).source).toBe('wikipedia');
    expect(complete).toHaveBeenCalledTimes(1); // still cached

    time += 2;
    allowAi = true;
    const later = await narrator.narrate(REQUEST);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(later).toMatchObject({ source: 'ai', text: AI_TEXT });
  });

  it('a cap-reached fallback is also cached only briefly', async () => {
    let time = 0;
    const { narrator, cache } = setup({ llmCap: 0, now: () => time });
    await narrator.narrate(REQUEST);
    const key = TEXT_KEY;
    time = FALLBACK_TTL_MS + 1;
    expect(await cache.get(key)).toBeUndefined();
  });

  it('does not pass the client abort signal to the AI or the landmark lookup, and still caches the result', async () => {
    const controller = new AbortController();
    const { narrator, complete, getById, cache } = setup({
      llm: () => {
        controller.abort(new Error('client left')); // the client leaves while the paid call is running
        return Promise.resolve({ text: AI_TEXT, model: 'm' });
      },
    });
    const result = await narrator.narrate(REQUEST, controller.signal);
    expect(result.source).toBe('ai');
    expect(complete.mock.calls[0][2]).toBeUndefined();
    expect(getById.mock.calls[0][1]).toBeUndefined();
    expect(await cache.get(TEXT_KEY)).toEqual({ text: AI_TEXT, source: 'ai' });
  });

  it('a later request after the client left pays nothing: the AI text was cached', async () => {
    const controller = new AbortController();
    controller.abort(new Error('client left'));
    const { narrator, complete } = setup();
    await narrator.narrate(REQUEST, controller.signal);
    await narrator.narrate(REQUEST);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('an empty Wikipedia fallback is NOT_NARRATABLE: nothing cached, nothing sent to TTS', async () => {
    const onlyAsides = makeLandmark('(pronounced something) [1]');
    const { narrator, synthesize, cache, getById } = setup({ landmark: onlyAsides, llmCap: 0, voices: VOICES });
    const error = await narrator.narrate(REQUEST).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'NarrationError', code: 'NOT_NARRATABLE', status: 422 });
    expect(synthesize).not.toHaveBeenCalled();
    expect(await cache.get(TEXT_KEY)).toBeUndefined();
    await narrator.narrate(REQUEST).catch(() => undefined);
    expect(getById).toHaveBeenCalledTimes(2); // not cached
  });

});

describe('createNarrator: audio', () => {
  it('makes audio with the default voice, stores it and returns its url', async () => {
    const { narrator, synthesize, blobs } = setup({ voices: VOICES });
    const result = await narrator.narrate(REQUEST);
    expect(synthesize.mock.calls[0].slice(0, 2)).toEqual([AI_TEXT, 'voiceA']);
    expect(result.audio?.contentType).toBe(AUDIO_CONTENT_TYPE);
    const key = result.audio?.url.replace('/narrations/audio/', '') ?? '';
    expect(result.audio?.url).toMatch(/^\/narrations\/audio\/[a-f0-9]{64}$/);
    expect(isValidBlobKey(key)).toBe(true);
    expect(await blobs.get(key)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('uses the requested voice', async () => {
    const { narrator, synthesize } = setup({ voices: VOICES });
    await narrator.narrate({ ...REQUEST, voice: 'voiceB' });
    expect(synthesize.mock.calls[0][1]).toBe('voiceB');
  });

  it('counts the text length against the TTS cap', async () => {
    const { narrator, caps } = setup({ voices: VOICES });
    const reserve = vi.spyOn(caps, 'tryReserve');
    await narrator.narrate(REQUEST);
    expect(reserve).toHaveBeenCalledWith('llm', 1);
    expect(reserve).toHaveBeenCalledWith('tts', AI_TEXT.length);
  });

  it('returns text only when the TTS cap is reached, without calling TTS, and caches the text', async () => {
    const { narrator, synthesize, complete } = setup({ voices: VOICES, ttsCap: 10 });
    const result = await narrator.narrate(REQUEST);
    expect(result).toMatchObject({ source: 'ai', text: AI_TEXT, audio: null });
    expect(synthesize).not.toHaveBeenCalled();
    await narrator.narrate(REQUEST);
    expect(complete).toHaveBeenCalledTimes(1); // the text was cached
  });

  it('returns text only when TTS fails, releases the reservation, and retries only the audio next time', async () => {
    let ttsWorks = false;
    const { narrator, complete, synthesize, getById } = setup({
      voices: VOICES,
      synthesize: () =>
        ttsWorks ? Promise.resolve({ contentType: 'audio/mpeg', data: new Uint8Array([9]) }) : Promise.reject(new Error('tts down')),
    });
    const first = await narrator.narrate(REQUEST);
    expect(first).toMatchObject({ text: AI_TEXT, source: 'ai', audio: null });
    expect(synthesize).toHaveBeenCalledTimes(1);

    ttsWorks = true;
    const second = await narrator.narrate(REQUEST);
    expect(second.audio?.url).toMatch(/^\/narrations\/audio\//);
    expect(second.text).toBe(AI_TEXT);
    expect(complete).toHaveBeenCalledTimes(1); // no second AI call
    expect(getById).toHaveBeenCalledTimes(1); // no second landmark load
    expect(synthesize).toHaveBeenCalledTimes(2);

    const third = await narrator.narrate(REQUEST);
    expect(synthesize).toHaveBeenCalledTimes(2); // now fully cached
    expect(third).toEqual(second);
  });

  describe('TTS reservations', () => {
    const textLength = AI_TEXT.length;

    function withCaps(synthesize: TTSProvider['synthesize'], blobsPutError?: Error) {
      const { caps, events } = recordingCaps();
      const ctx = setup({ voices: VOICES, caps, synthesize });
      if (blobsPutError) vi.spyOn(ctx.blobs, 'put').mockRejectedValue(blobsPutError);
      return { ...ctx, events };
    }

    it('releases the reservation (for the reserving day) when the provider returns null', async () => {
      const { narrator, events } = withCaps(() => Promise.resolve(null));
      expect((await narrator.narrate(REQUEST)).audio).toBeNull();
      expect(events).toContain(`reserve:tts:${textLength}`);
      expect(events).toContain(`release:tts:${textLength}:2026-10-27`);
    });

    it.each([400, 401, 402, 422, 429])('releases the reservation when ElevenLabs answers %d (nothing was made)', async (status) => {
      const { narrator, events } = withCaps(() => Promise.reject(new UpstreamError('elevenlabs', `HTTP ${status}`, status)));
      const result = await narrator.narrate(REQUEST);
      expect(result).toMatchObject({ text: AI_TEXT, audio: null });
      expect(events).toContain(`release:tts:${textLength}:2026-10-27`);
    });

    it.each([500, 502, 503])('keeps the reservation on a %d (the voice service may have billed it)', async (status) => {
      const { narrator, events } = withCaps(() => Promise.reject(new UpstreamError('elevenlabs', `HTTP ${status}`, status)));
      const result = await narrator.narrate(REQUEST);
      expect(result.audio).toBeNull();
      expect(events.some((e) => e.startsWith('release:'))).toBe(false);
    });

    it('keeps the reservation on a timeout', async () => {
      const { narrator, events } = withCaps(() => Promise.reject(new UpstreamError('elevenlabs', 'timed out')));
      expect((await narrator.narrate(REQUEST)).audio).toBeNull();
      expect(events.some((e) => e.startsWith('release:'))).toBe(false);
    });

    it('keeps the reservation on a network error or an abort', async () => {
      for (const error of [new Error('aborted'), new DOMException('stop', 'AbortError')]) {
        const { narrator, events } = withCaps(() => Promise.reject(error));
        expect((await narrator.narrate(REQUEST)).audio).toBeNull();
        expect(events.some((e) => e.startsWith('release:'))).toBe(false);
      }
    });

    it('keeps the reservation when storing the audio fails (the audio was paid for)', async () => {
      const { narrator, events } = withCaps(
        () => Promise.resolve({ contentType: 'audio/mpeg', data: new Uint8Array([1]) }),
        new Error('disk full'),
      );
      const result = await narrator.narrate(REQUEST);
      expect(result).toMatchObject({ text: AI_TEXT, audio: null });
      expect(events.some((e) => e.startsWith('release:'))).toBe(false);
    });

    it('does not reserve at all when the server has no voices', async () => {
      const { caps, events } = recordingCaps();
      const { narrator } = setup({ caps });
      await narrator.narrate(REQUEST);
      expect(events).toEqual(['reserve:llm:1']);
    });
  });

  describe('text is cached before the audio starts', () => {
    it('has the AI text cached by the time TTS is called', async () => {
      let cachedDuringTts: unknown;
      const ctx = setup({ voices: VOICES });
      ctx.synthesize.mockImplementation(async () => {
        cachedDuringTts = await ctx.cache.get(TEXT_KEY);
        return { contentType: 'audio/mpeg', data: new Uint8Array([1]) };
      });
      await ctx.narrator.narrate(REQUEST);
      expect(cachedDuringTts).toEqual({ text: AI_TEXT, source: 'ai' });
    });

    it('a TTS failure leaves the text cached, and the next request pays no AI call', async () => {
      let ttsWorks = false;
      const { narrator, complete, synthesize } = setup({
        voices: VOICES,
        synthesize: () =>
          ttsWorks ? Promise.resolve({ contentType: 'audio/mpeg', data: new Uint8Array([1]) }) : Promise.reject(new Error('tts down')),
      });
      expect((await narrator.narrate(REQUEST)).audio).toBeNull();
      ttsWorks = true;
      const second = await narrator.narrate(REQUEST);
      expect(second.audio).not.toBeNull();
      expect(complete).toHaveBeenCalledTimes(1);
      expect(synthesize).toHaveBeenCalledTimes(2);
    });

    it('a TTS abort or timeout also leaves the text cached', async () => {
      const { narrator, complete, cache } = setup({
        voices: VOICES,
        synthesize: () => Promise.reject(new UpstreamError('elevenlabs', 'timed out')),
      });
      await narrator.narrate(REQUEST);
      expect(await cache.get(TEXT_KEY)).toEqual({ text: AI_TEXT, source: 'ai' });
      await narrator.narrate(REQUEST);
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  it('when the TTS cap blocked audio, a later request adds the audio without a new AI call', async () => {
    let ttsAllowed = false;
    const caps: DailyCaps = {
      tryReserve: (kind) => Promise.resolve(kind === 'llm' || ttsAllowed ? '2026-10-27' : null),
      release: () => Promise.resolve(),
    };
    const { narrator, complete, synthesize } = setup({ voices: VOICES, caps });
    expect((await narrator.narrate(REQUEST)).audio).toBeNull();
    expect(synthesize).not.toHaveBeenCalled();

    ttsAllowed = true;
    const later = await narrator.narrate(REQUEST);
    expect(later.audio).not.toBeNull();
    expect(later.text).toBe(AI_TEXT);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('does not pass the client abort signal to TTS; the audio is still made and stored', async () => {
    const controller = new AbortController();
    const { narrator, synthesize, blobs } = setup({
      voices: VOICES,
      synthesize: () => {
        controller.abort(new Error('client left'));
        return Promise.resolve({ contentType: 'audio/mpeg', data: new Uint8Array([7]) });
      },
    });
    const result = await narrator.narrate(REQUEST, controller.signal);
    expect(synthesize.mock.calls[0][2]).toBeUndefined();
    expect(result.audio).not.toBeNull();
    expect(await blobs.has(result.audio?.url.split('/').pop() ?? '')).toBe(true);
  });

  it('regenerates only the audio when the cached audio file was cleaned up', async () => {
    const { narrator, blobs, complete, synthesize } = setup({ voices: VOICES });
    const first = await narrator.narrate(REQUEST);
    const key = first.audio?.url.split('/').pop() ?? '';
    // Simulate the file being cleaned up: evict it by filling the (100-entry) memory store.
    for (let i = 0; i < 101; i += 1) await blobs.put(i.toString(16).padStart(64, '0'), new Uint8Array([0]));
    expect(await blobs.has(key)).toBe(false);

    const second = await narrator.narrate(REQUEST);
    expect(second.audio).not.toBeNull();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(await blobs.has(second.audio?.url.split('/').pop() ?? '')).toBe(true);
  });

  it('does not let a cache that throws on get hide the pipeline (propagates, never charges twice silently)', async () => {
    const cache: CacheStore = {
      get: () => Promise.reject(new Error('cache down')),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    };
    const { narrator, complete } = setup({ cache });
    await expect(narrator.narrate(REQUEST)).rejects.toThrow('cache down');
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('createNarrator: text shared across voices', () => {
  it('uses one AI call and two TTS calls for two voices, with different audio urls', async () => {
    const { narrator, complete, synthesize } = setup({ voices: VOICES });
    const a = await narrator.narrate({ ...REQUEST, voice: 'voiceA' });
    const b = await narrator.narrate({ ...REQUEST, voice: 'voiceB' });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(a.text).toBe(b.text);
    expect(a.audio?.url).not.toBe(b.audio?.url);
    expect(synthesize.mock.calls.map((c) => c[1])).toEqual(['voiceA', 'voiceB']);
  });

  it('keeps a voice cached after another voice was generated', async () => {
    const { narrator, synthesize } = setup({ voices: VOICES });
    await narrator.narrate({ ...REQUEST, voice: 'voiceA' });
    await narrator.narrate({ ...REQUEST, voice: 'voiceB' });
    await narrator.narrate({ ...REQUEST, voice: 'voiceA' });
    expect(synthesize).toHaveBeenCalledTimes(2);
  });
});

describe('createNarrator: single flight (concurrent identical requests)', () => {
  it('runs one landmark load and one AI call for many concurrent uncached requests', async () => {
    const gate = deferred();
    const { narrator, complete, getById } = setup({
      llm: async () => {
        await gate.promise;
        return { text: AI_TEXT, model: 'm' };
      },
    });
    const pending = Array.from({ length: 8 }, () => narrator.narrate(REQUEST));
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve();
    const results = await Promise.all(pending);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r.text).toBe(AI_TEXT);
  });

  it('reserves only one AI call for concurrent requests', async () => {
    const gate = deferred();
    const { caps, events } = recordingCaps();
    const { narrator } = setup({
      caps,
      llm: async () => {
        await gate.promise;
        return { text: AI_TEXT, model: 'm' };
      },
    });
    const pending = Array.from({ length: 5 }, () => narrator.narrate(REQUEST));
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve();
    await Promise.all(pending);
    expect(events.filter((e) => e.startsWith('reserve:llm'))).toHaveLength(1);
  });

  it('runs one TTS call for many concurrent requests for the same audio', async () => {
    const gate = deferred();
    const { narrator, synthesize } = setup({
      voices: VOICES,
      synthesize: async () => {
        await gate.promise;
        return { contentType: 'audio/mpeg', data: new Uint8Array([1, 2]) };
      },
    });
    const pending = Array.from({ length: 6 }, () => narrator.narrate(REQUEST));
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve();
    const results = await Promise.all(pending);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => r.audio?.url)).size).toBe(1);
  });

  it('reserves TTS characters only once for concurrent requests', async () => {
    const gate = deferred();
    const { caps, events } = recordingCaps();
    const { narrator } = setup({
      voices: VOICES,
      caps,
      synthesize: async () => {
        await gate.promise;
        return { contentType: 'audio/mpeg', data: new Uint8Array([1]) };
      },
    });
    const pending = Array.from({ length: 4 }, () => narrator.narrate(REQUEST));
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve();
    await Promise.all(pending);
    expect(events.filter((e) => e.startsWith('reserve:tts'))).toHaveLength(1);
  });

  it('concurrent requests for different voices share the text but each make their own audio', async () => {
    const { narrator, complete, synthesize } = setup({ voices: VOICES });
    await Promise.all([
      narrator.narrate({ ...REQUEST, voice: 'voiceA' }),
      narrator.narrate({ ...REQUEST, voice: 'voiceB' }),
      narrator.narrate({ ...REQUEST, voice: 'voiceA' }),
    ]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('concurrent requests for different landmarks do not wait for each other', async () => {
    const { narrator, complete } = setup();
    await Promise.all([narrator.narrate(REQUEST), narrator.narrate({ ...REQUEST, landmarkId: 'wiki:2' })]);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('a landmark lookup failure reaches every concurrent request and does not wedge later ones', async () => {
    const { narrator } = setup({ getByIdError: new Error('source down') });
    const results = await Promise.allSettled([narrator.narrate(REQUEST), narrator.narrate(REQUEST)]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    await expect(narrator.narrate(REQUEST)).rejects.toThrow('source down');
  });
});
