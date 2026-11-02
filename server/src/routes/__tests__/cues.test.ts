import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_TOKEN_HEADER, ENDPOINTS } from '@shared/api/endpoints';
import type { CueResponse } from '@shared/api/cues';
import { isApiError } from '@shared/api/errors';
import { ORIENTATION_CUE_TEXT } from '@shared/narration/cues';
import type { SynthesizedAudio, TTSProvider, TtsProviderName } from '@shared/narration/tts-provider';
import { createApp } from '../../app';
import { TEST_TOKEN, testConfig, testDeps } from '../../__fixtures__/test-app';
import { AUDIO_CONTENT_TYPE, isValidBlobKey } from '../../cache/blob-store';
import { createMemoryBlobStore } from '../../cache/memory-blob-store';
import { createMemoryCacheStore } from '../../cache/memory-cache-store';
import { createDailyCaps } from '../../costs/daily-caps';
import { UpstreamError } from '../../http/upstream-error';
import { createCueService } from '../../narration/cues';

const VOICES = [
  { id: 'voiceA', label: 'Warm' },
  { id: 'voiceB', label: 'Calm' },
];
const BYTES = new Uint8Array([0xff, 0xfb, 9, 8, 7]);

interface Options {
  provider?: TtsProviderName;
  ttsCap?: number;
  synthesize?: TTSProvider['synthesize'];
  rateLimitPerMinute?: number;
}

function make(options: Options = {}) {
  const provider = options.provider ?? 'elevenlabs';
  const synthesize = vi.fn<TTSProvider['synthesize']>(
    options.synthesize ?? (() => Promise.resolve<SynthesizedAudio>({ contentType: 'audio/mpeg', data: BYTES })),
  );
  const tts: TTSProvider = { name: provider, voices: provider === 'none' ? [] : VOICES, synthesize };
  const blobs = createMemoryBlobStore();
  const logs: string[] = [];
  const caps = createDailyCaps({
    cache: createMemoryCacheStore(),
    llmCalls: 100,
    ttsChars: options.ttsCap ?? 5000,
    log: (m) => logs.push(m),
  });
  const cues = createCueService({ blobs, tts, caps, log: (m) => logs.push(m) });
  const app = createApp(
    testConfig({ rateLimitPerMinute: options.rateLimitPerMinute ?? 1000 }),
    testDeps({ cues, blobs, tts }),
  );
  return { app, synthesize, blobs, logs };
}

type App = ReturnType<typeof make>['app'];

const get = (app: App, path: string) => request(app).get(`${ENDPOINTS.cues}/${path}`).set(APP_TOKEN_HEADER, TEST_TOKEN);

beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe('GET /narrations/cues/:cue', () => {
  it('returns the fixed text and a servable audio url for every cue', async () => {
    const { app, synthesize } = make();
    for (const cue of ['ahead', 'left', 'right'] as const) {
      const res = await get(app, cue);
      const body = res.body as CueResponse;
      expect(res.status).toBe(200);
      expect(body.cue).toBe(cue);
      expect(body.text).toBe(ORIENTATION_CUE_TEXT[cue]);
      expect(body.audio?.contentType).toBe(AUDIO_CONTENT_TYPE);
      expect(body.audio?.url.startsWith(`${ENDPOINTS.narrationAudio}/`)).toBe(true);
      expect(isValidBlobKey(body.audio?.url.split('/').pop() ?? '')).toBe(true);
    }
    expect(synthesize).toHaveBeenCalledTimes(3);
    expect(synthesize.mock.calls[0].slice(0, 2)).toEqual([ORIENTATION_CUE_TEXT.ahead, 'voiceA']);
  });

  it('serves the returned url through the existing audio route', async () => {
    const { app } = make();
    const body = (await get(app, 'left')).body as CueResponse;
    const audio = await request(app)
      .get(body.audio?.url ?? '')
      .set(APP_TOKEN_HEADER, TEST_TOKEN)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(audio.status).toBe(200);
    expect(audio.headers['content-type']).toBe(AUDIO_CONTENT_TYPE);
    expect(Array.from(audio.body as Buffer)).toEqual(Array.from(BYTES));
  });

  it('uses the cache on the second request: same url, no second TTS call', async () => {
    const { app, synthesize } = make();
    const first = (await get(app, 'right')).body as CueResponse;
    const second = (await get(app, 'right')).body as CueResponse;
    expect(second).toEqual(first);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('shares one synthesis between simultaneous requests', async () => {
    const { app, synthesize } = make();
    const results = await Promise.all([get(app, 'ahead'), get(app, 'ahead'), get(app, 'ahead')]);
    expect(results.every((r) => r.status === 200 && (r.body as CueResponse).audio !== null)).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('makes separate audio per voice', async () => {
    const { app, synthesize } = make();
    const a = (await get(app, 'ahead').query({ voice: 'voiceA' })).body as CueResponse;
    const b = (await get(app, 'ahead').query({ voice: 'voiceB' })).body as CueResponse;
    expect(a.audio?.url).not.toBe(b.audio?.url);
    expect(synthesize.mock.calls.map((c) => c[1])).toEqual(['voiceA', 'voiceB']);
  });

  it('returns audio null for provider "none" and never calls TTS', async () => {
    const { app, synthesize } = make({ provider: 'none' });
    const res = await get(app, 'left');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cue: 'left', text: ORIENTATION_CUE_TEXT.left, audio: null });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('returns audio null without calling TTS once the daily TTS cap is reached', async () => {
    const { app, synthesize, logs } = make({ ttsCap: 10 });
    const res = await get(app, 'ahead'); // 16 characters, over the cap of 10
    expect(res.status).toBe(200);
    expect((res.body as CueResponse).audio).toBeNull();
    expect((res.body as CueResponse).text).toBe(ORIENTATION_CUE_TEXT.ahead);
    expect(synthesize).not.toHaveBeenCalled();
    expect(logs.some((m) => m.includes('cap reached'))).toBe(true);
  });

  it('counts synthesis toward the cap, and cache hits do not spend more', async () => {
    const { app, synthesize } = make({ ttsCap: ORIENTATION_CUE_TEXT.ahead.length });
    expect(((await get(app, 'ahead')).body as CueResponse).audio).not.toBeNull();
    expect(((await get(app, 'ahead')).body as CueResponse).audio).not.toBeNull(); // cached, no new spend
    expect(((await get(app, 'left')).body as CueResponse).audio).toBeNull(); // cap used up
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('returns audio null when TTS fails, logging only the error name, and retries next time', async () => {
    let fail = true;
    const { app, synthesize, logs } = make({
      synthesize: () =>
        fail
          ? Promise.reject(new UpstreamError('elevenlabs', 'HTTP 500 sk-secret', 500))
          : Promise.resolve({ contentType: 'audio/mpeg', data: BYTES }),
    });
    const res = await get(app, 'right');
    expect(res.status).toBe(200);
    expect((res.body as CueResponse).audio).toBeNull();
    expect(logs.join(' ')).toContain('TTS failed');
    expect(logs.join(' ')).not.toContain('sk-secret');
    fail = false;
    expect(((await get(app, 'right')).body as CueResponse).audio).not.toBeNull();
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('returns audio null when TTS times out', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const { app } = make({ synthesize: () => Promise.reject(timeout) });
    const res = await get(app, 'ahead');
    expect(res.status).toBe(200);
    expect((res.body as CueResponse).audio).toBeNull();
  });

  it('returns audio null (not 500) when the audio store fails, logging a fixed message', async () => {
    const { app, blobs, logs } = make();
    vi.spyOn(blobs, 'has').mockRejectedValue(new Error('EACCES /secret/path'));
    const res = await get(app, 'left');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cue: 'left', text: ORIENTATION_CUE_TEXT.left, audio: null });
    expect(logs.join(' ')).toContain('[cues]');
    expect(logs.join(' ')).not.toContain('/secret/path');
  });

  it.each(['behind', 'LEFT', '%20', 'left%2F..', '__proto__', 'constructor'])('returns 400 BAD_REQUEST for the cue "%s"', async (cue) => {
    const { app, synthesize } = make();
    const res = await get(app, cue);
    expect(res.status).toBe(400);
    expect(isApiError(res.body)).toBe(true);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(synthesize).not.toHaveBeenCalled();
  });

  it.each(['a.b', 'x y', 'x'.repeat(65)])('returns 400 for a malformed voice "%s"', async (voice) => {
    const { app, synthesize } = make();
    const res = await get(app, 'left').query({ voice });
    expect(res.status).toBe(400);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('falls back to the default voice for an unknown voice, logging without the id', async () => {
    const { app, synthesize, logs } = make();
    const res = await get(app, 'left').query({ voice: 'nope-not-a-voice' });
    expect(res.status).toBe(200);
    expect((res.body as CueResponse).audio).not.toBeNull();
    expect(synthesize.mock.calls[0][1]).toBe('voiceA');
    expect(logs.some((m) => m.includes('Unknown voice'))).toBe(true);
    expect(logs.join('\n')).not.toContain('nope-not-a-voice');
    // Same audio as asking for the default voice explicitly: no second synthesis.
    const again = await get(app, 'left');
    expect((again.body as CueResponse).audio).toEqual((res.body as CueResponse).audio);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it('requires the app token (401) and never reaches TTS without it', async () => {
    const { app, synthesize } = make();
    const res = await request(app).get(`${ENDPOINTS.cues}/left`);
    expect(res.status).toBe(401);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('is limited by the general per-IP rate limit', async () => {
    const { app } = make({ rateLimitPerMinute: 2 });
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await get(app, 'left')).status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('does not clash with the other narration routes', async () => {
    const { app } = make();
    const audio = await request(app).get(`${ENDPOINTS.narrationAudio}/${'a'.repeat(64)}`).set(APP_TOKEN_HEADER, TEST_TOKEN);
    expect(audio.status).toBe(404);
    const post = await request(app).post(ENDPOINTS.narrations).set(APP_TOKEN_HEADER, TEST_TOKEN).send({});
    expect(post.status).toBe(400);
    expect((await get(app, 'left/extra')).status).toBe(404);
  });
});
