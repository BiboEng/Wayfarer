import { describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../../http/upstream-error';
import { createElevenLabsProvider } from '../elevenlabs-provider';
import { createNoneProvider } from '../none-provider';
import { createTtsProvider } from '../create-tts-provider';

type FetchFn = typeof fetch;

const KEY = 'el-test-SECRET-KEY-98765';
const VOICES = [
  { id: 'voiceA', label: 'Warm' },
  { id: 'voiceB', label: 'Calm' },
];
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);

const audio = (status = 200, body: Uint8Array = MP3) => new Response(body as unknown as ConstructorParameters<typeof Response>[0], { status, headers: { 'Content-Type': 'audio/mpeg' } });

const hanging: FetchFn = (_url, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
  });

function provider(fetchFn: FetchFn, extra: Partial<Parameters<typeof createElevenLabsProvider>[0]> = {}) {
  return createElevenLabsProvider({ apiKey: KEY, voices: VOICES, fetchFn, ...extra });
}

describe('createNoneProvider', () => {
  it('has no voices and returns null audio, so the app speaks on the device', async () => {
    const none = createNoneProvider();
    expect(none.name).toBe('none');
    expect(none.voices).toEqual([]);
    expect(await none.synthesize('text', 'device')).toBeNull();
  });
});

describe('createElevenLabsProvider', () => {
  it('exposes its name and voices (the first is the default)', () => {
    const p = provider(vi.fn<FetchFn>());
    expect(p.name).toBe('elevenlabs');
    expect(p.voices).toEqual(VOICES);
  });

  it('POSTs the text to the voice url asking for MP3, with the key in a header only', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(audio());
    await provider(fetchFn).synthesize('Hello there', 'voiceB');
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://api.elevenlabs.io/v1/text-to-speech/voiceB?output_format=mp3_44100_128');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' });
    expect(JSON.parse(String(init?.body))).toEqual({ text: 'Hello there', model_id: 'eleven_flash_v2_5' });
    expect(String(url)).not.toContain(KEY);
    expect(String(init?.body)).not.toContain(KEY);
  });

  it('returns the audio bytes as audio/mpeg', async () => {
    const result = await provider(vi.fn<FetchFn>().mockResolvedValue(audio())).synthesize('Hi', 'voiceA');
    expect(result).toEqual({ contentType: 'audio/mpeg', data: MP3 });
  });

  it('allows a different model id', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(audio());
    await provider(fetchFn, { modelId: 'eleven_multilingual_v2' }).synthesize('Hi', 'voiceA');
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body)).model_id).toBe('eleven_multilingual_v2');
  });

  it.each(['unknown', '../x', 'voiceA/../../admin', 'voiceA?x=1', ''])(
    'rejects the voice %j without any request (only configured voices reach the url)',
    async (voice) => {
      const fetchFn = vi.fn<FetchFn>();
      await expect(provider(fetchFn).synthesize('Hi', voice)).rejects.toBeInstanceOf(UpstreamError);
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it.each([401, 402, 422, 429, 500, 503])('throws UpstreamError with the status for HTTP %d (no retry)', async (status) => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(audio(status, new Uint8Array([1]))));
    const error = await provider(fetchFn).synthesize('Hi', 'voiceA').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(status);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('throws on empty audio', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(audio(200, new Uint8Array(0)));
    await expect(provider(fetchFn).synthesize('Hi', 'voiceA')).rejects.toThrow(/empty audio/);
  });

  it('passes a signal so the call is bounded, and uses a 20 second default timeout', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValue(audio());
      await provider(fetchFn).synthesize('Hi', 'voiceA');
      expect(spy).toHaveBeenCalledWith(20_000);
      expect(fetchFn.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      spy.mockRestore();
    }
  });

  it('times out a hanging request with "timed out" (real clock, short timeout)', async () => {
    const error = (await provider(hanging, { timeoutMs: 30 }).synthesize('Hi', 'voiceA').catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.message).toContain('timed out');
  });

  it('rethrows the original error when the caller cancelled', async () => {
    const controller = new AbortController();
    const reason = new Error('client left');
    const pending = provider(hanging).synthesize('Hi', 'voiceA', controller.signal).catch((e: unknown) => e);
    controller.abort(reason);
    expect(await pending).toBe(reason);
  });

  it('error messages never contain the key, url or text', async () => {
    const leaky = new TypeError(`failed https://api.elevenlabs.io/v1 xi-api-key ${KEY} "Secret story text"`);
    for (const fetchFn of [
      vi.fn<FetchFn>().mockRejectedValue(leaky),
      vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(new Response(`bad key ${KEY}`, { status: 401 }))),
    ]) {
      const error = (await provider(fetchFn).synthesize('Secret story text', 'voiceA').catch((e: unknown) => e)) as Error;
      const everything = `${error.message} ${error.name} ${String(error.stack)} ${JSON.stringify(error)}`;
      expect(everything).not.toContain(KEY);
      expect(everything).not.toContain('elevenlabs.io');
      expect(everything).not.toContain('Secret story text');
      expect(everything).not.toContain('bad key');
    }
  });
});

describe('createTtsProvider', () => {
  it('returns the none provider by default', () => {
    expect(createTtsProvider({ ttsProvider: 'none', elevenLabs: null }).name).toBe('none');
  });

  it('returns ElevenLabs with the configured voices', () => {
    const p = createTtsProvider({ ttsProvider: 'elevenlabs', elevenLabs: { apiKey: KEY, voices: VOICES } });
    expect(p.name).toBe('elevenlabs');
    expect(p.voices).toEqual(VOICES);
  });

  it('falls back to none if elevenlabs is chosen without a config', () => {
    expect(createTtsProvider({ ttsProvider: 'elevenlabs', elevenLabs: null }).name).toBe('none');
  });

  it('ignores ElevenLabs settings when the provider is none', () => {
    expect(createTtsProvider({ ttsProvider: 'none', elevenLabs: { apiKey: KEY, voices: VOICES } }).name).toBe('none');
  });
});
