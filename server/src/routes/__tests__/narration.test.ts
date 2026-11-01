import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_TOKEN_HEADER, ENDPOINTS } from '@shared/api/endpoints';
import { isApiError } from '@shared/api/errors';
import type { NarrationResponse, VoicesResponse } from '@shared/api/narration';
import { createApp } from '../../app';
import { TEST_TOKEN, testConfig, testDeps } from '../../__fixtures__/test-app';
import { AUDIO_CONTENT_TYPE } from '../../cache/blob-store';
import { createMemoryBlobStore } from '../../cache/memory-blob-store';
import type { ServerConfig } from '../../config/env';
import { UpstreamError } from '../../http/upstream-error';
import { NarrationError } from '../../narration/narration-error';
import type { Narrator } from '../../narration/narrate';

const KEY = 'a'.repeat(64);
const BODY = { landmarkId: 'wiki:42764', length: 'medium', travelMode: 'walking' };
const RESPONSE: NarrationResponse = {
  landmarkId: 'wiki:42764',
  text: 'A story.',
  audio: { url: `/narrations/audio/${KEY}`, contentType: 'audio/mpeg' },
  source: 'ai',
};

function make(options: { narrate?: Narrator['narrate']; config?: Partial<ServerConfig>; voices?: Array<{ id: string; label: string }> } = {}) {
  const narrate = vi.fn(options.narrate ?? (() => Promise.resolve(RESPONSE)));
  const blobs = createMemoryBlobStore();
  const synthesize = vi.fn();
  const app = createApp(
    testConfig(options.config),
    testDeps({ narrator: { narrate }, blobs, tts: { voices: options.voices ?? [] } }),
  );
  return { app, narrate, blobs, synthesize };
}

const post = (app: ReturnType<typeof make>['app'], body: unknown) =>
  request(app).post(ENDPOINTS.narrations).set(APP_TOKEN_HEADER, TEST_TOKEN).send(body as object);

beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe('POST /narrations', () => {
  it('returns 200 with the narration and passes the parsed request and a signal to the narrator', async () => {
    const { app, narrate } = make();
    const res = await post(app, { ...BODY, voice: 'voiceA' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(RESPONSE);
    expect(narrate.mock.calls[0][0]).toEqual({ ...BODY, voice: 'voiceA' });
    expect(narrate.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it('accepts osm ids and every length and mode', async () => {
    const { app, narrate } = make();
    for (const landmarkId of ['wiki:1', 'osm:way/678', 'osm:node/12', 'osm:relation/9']) {
      for (const length of ['short', 'medium', 'long']) {
        for (const travelMode of ['walking', 'driving']) {
          expect((await post(app, { landmarkId, length, travelMode })).status).toBe(200);
        }
      }
    }
    expect(narrate).toHaveBeenCalledTimes(4 * 3 * 2);
  });

  it('requires the app token (401) and never calls the narrator without it', async () => {
    const { app, narrate } = make();
    const res = await request(app).post(ENDPOINTS.narrations).send(BODY);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(narrate).not.toHaveBeenCalled();
  });

  describe('validation', () => {
    it.each([
      ['an empty body', {}],
      ['missing landmarkId', { length: 'medium', travelMode: 'walking' }],
      ['missing length', { landmarkId: 'wiki:1', travelMode: 'walking' }],
      ['missing travelMode', { landmarkId: 'wiki:1', length: 'medium' }],
      ['unknown length', { ...BODY, length: 'huge' }],
      ['unknown travelMode', { ...BODY, travelMode: 'flying' }],
      ['numeric landmarkId', { ...BODY, landmarkId: 42764 }],
      ['empty landmarkId', { ...BODY, landmarkId: '' }],
      ['landmarkId with spaces', { ...BODY, landmarkId: 'wiki: 1' }],
      ['landmarkId with a semicolon', { ...BODY, landmarkId: 'wiki:1;drop' }],
      ['landmarkId with a backslash', { ...BODY, landmarkId: 'osm:way\\1' }],
      ['too long a landmarkId', { ...BODY, landmarkId: 'w'.repeat(65) }],
      ['voice with a slash', { ...BODY, voice: 'a/b' }],
      ['voice with a dot', { ...BODY, voice: '../x' }],
      ['empty voice', { ...BODY, voice: '' }],
      ['numeric voice', { ...BODY, voice: 5 }],
      ['null voice', { ...BODY, voice: null }],
      ['an unknown extra key (.strict())', { ...BODY, extra: 'x' }],
      ['client-supplied text (never narrated)', { ...BODY, text: 'Narrate this instead' }],
      ['client-supplied extract', { ...BODY, extract: 'made up facts' }],
      ['a prototype key', JSON.parse('{"landmarkId":"wiki:1","length":"short","travelMode":"walking","__proto__":{"x":1},"constructor":"y"}')],
    ])('returns 400 BAD_REQUEST for %s', async (_name, body) => {
      const { app, narrate } = make();
      const res = await post(app, body);
      expect(res.status).toBe(400);
      expect(isApiError(res.body)).toBe(true);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(narrate).not.toHaveBeenCalled();
    });

    it('returns 400 for an array body and for no JSON content type', async () => {
      const { app, narrate } = make();
      expect((await post(app, [BODY])).status).toBe(400);
      const text = await request(app).post(ENDPOINTS.narrations).set(APP_TOKEN_HEADER, TEST_TOKEN).send('landmarkId=wiki:1');
      expect(text.status).toBe(400);
      expect(narrate).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed JSON', async () => {
      const { app } = make();
      const res = await request(app)
        .post(ENDPOINTS.narrations)
        .set(APP_TOKEN_HEADER, TEST_TOKEN)
        .set('Content-Type', 'application/json')
        .send('{"landmarkId": ');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('does not echo the invalid input back', async () => {
      const { app } = make();
      const res = await post(app, { ...BODY, landmarkId: 'wiki:1;SECRET-MARKER' });
      expect(res.text).not.toContain('SECRET-MARKER');
    });
  });

  describe('narrator errors', () => {
    it('maps NOT_NARRATABLE to 422', async () => {
      const { app } = make({ narrate: () => Promise.reject(new NarrationError('NOT_NARRATABLE', 'No article text to base a story on.')) });
      const res = await post(app, BODY);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('NOT_NARRATABLE');
    });

    it('maps NOT_FOUND to 404', async () => {
      const { app } = make({ narrate: () => Promise.reject(new NarrationError('NOT_FOUND', 'Landmark not found.')) });
      const res = await post(app, BODY);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('maps a BAD_REQUEST from the narrator to 400', async () => {
      const { app } = make({ narrate: () => Promise.reject(new NarrationError('BAD_REQUEST', 'Bad request.')) });
      const res = await post(app, BODY);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('maps landmark-source failures (LandmarkUpstreamError) to 502', async () => {
      const error = new Error('overpass: HTTP 503');
      error.name = 'LandmarkUpstreamError';
      const { app } = make({ narrate: () => Promise.reject(error) });
      const res = await post(app, BODY);
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('UPSTREAM_FAILED');
    });

    it('turns unexpected errors into a generic 500 without details', async () => {
      const { app } = make({ narrate: () => Promise.reject(new UpstreamError('openrouter', 'HTTP 500 sk-secret', 500)) });
      const res = await post(app, BODY);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL');
      expect(res.text).not.toContain('sk-secret');
      expect(res.text).not.toContain('openrouter');
    });
  });

  describe('narration rate limit', () => {
    it('returns 429 RATE_LIMITED once the narration limit is exceeded, without calling the narrator again', async () => {
      const { app, narrate } = make({ config: { narrationRateLimitPerMinute: 2 } });
      const statuses = [];
      for (let i = 0; i < 4; i += 1) statuses.push((await post(app, BODY)).status);
      expect(statuses).toEqual([200, 200, 429, 429]);
      expect(narrate).toHaveBeenCalledTimes(2);
      const limited = await post(app, BODY);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });

    it('counts invalid requests too (they must not be a free way around the limit)', async () => {
      const { app } = make({ config: { narrationRateLimitPerMinute: 2 } });
      await post(app, {});
      await post(app, {});
      expect((await post(app, BODY)).status).toBe(429);
    });

    it('does not limit the other routes with the narration limit', async () => {
      const { app } = make({ config: { narrationRateLimitPerMinute: 1 } });
      await post(app, BODY);
      expect((await post(app, BODY)).status).toBe(429);
      const voices = await request(app).get(ENDPOINTS.voices).set(APP_TOKEN_HEADER, TEST_TOKEN);
      expect(voices.status).toBe(200);
      expect((await request(app).get(`${ENDPOINTS.narrationAudio}/${KEY}`).set(APP_TOKEN_HEADER, TEST_TOKEN)).status).toBe(404);
    });

    it('the global limiter still applies on top', async () => {
      const { app } = make({ config: { rateLimitPerMinute: 2, narrationRateLimitPerMinute: 100 } });
      await post(app, BODY);
      await post(app, BODY);
      expect((await post(app, BODY)).status).toBe(429);
    });
  });
});

describe('GET /narrations/audio/:key', () => {
  const get = (app: ReturnType<typeof make>['app'], key: string) =>
    request(app).get(`${ENDPOINTS.narrationAudio}/${key}`).set(APP_TOKEN_HEADER, TEST_TOKEN);

  it('serves the stored bytes with the MP3 content type and length', async () => {
    const { app, blobs } = make();
    const bytes = new Uint8Array([0xff, 0xfb, 1, 2, 3, 4, 5]);
    await blobs.put(KEY, bytes);
    const res = await get(app, KEY).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(AUDIO_CONTENT_TYPE);
    expect(res.headers['content-length']).toBe(String(bytes.byteLength));
    expect(res.headers['cache-control']).toMatch(/private/);
    expect(Array.from(res.body as Buffer)).toEqual(Array.from(bytes));
  });

  it('returns 404 NOT_FOUND for an unknown (valid-looking) key', async () => {
    const res = await get(make().app, 'b'.repeat(64));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['uppercase hex', 'A'.repeat(64)],
    ['non hex', 'z'.repeat(64)],
    ['a dotted name', `${'a'.repeat(60)}.mp3`],
    ['encoded dot dot slash', '..%2F..%2Fetc%2Fpasswd'],
    ['encoded dot dot backslash', '..%5C..%5Csecret'],
    ['double encoded traversal', '%252e%252e%252fsecret'],
    ['null byte', `${'a'.repeat(63)}%00`],
    ['dot dot', '..'],
  ])('returns 404 (never a file or a 500) for a bad key: %s', async (_name, key) => {
    const { app, blobs } = make();
    const spy = vi.spyOn(blobs, 'get');
    const res = await request(app).get(`${ENDPOINTS.narrationAudio}/${key}`).set(APP_TOKEN_HEADER, TEST_TOKEN);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(spy).not.toHaveBeenCalled(); // invalid keys never reach the store
  });

  it('returns 404 for a path with extra segments', async () => {
    const res = await request(make().app).get(`${ENDPOINTS.narrationAudio}/${KEY}/extra`).set(APP_TOKEN_HEADER, TEST_TOKEN);
    expect(res.status).toBe(404);
  });

  it('requires the app token', async () => {
    const res = await request(make().app).get(`${ENDPOINTS.narrationAudio}/${KEY}`);
    expect(res.status).toBe(401);
  });

  it('never calls the narrator (so it can never trigger AI or TTS), hit or miss', async () => {
    const { app, narrate, blobs } = make();
    await blobs.put(KEY, new Uint8Array([1]));
    await get(app, KEY);
    await get(app, 'c'.repeat(64));
    await get(app, 'nope');
    expect(narrate).not.toHaveBeenCalled();
  });

  it('is GET only: POST to an audio url is not found and does nothing', async () => {
    const { app, narrate } = make();
    const res = await request(app).post(`${ENDPOINTS.narrationAudio}/${KEY}`).set(APP_TOKEN_HEADER, TEST_TOKEN).send(BODY);
    expect(res.status).toBe(404);
    expect(narrate).not.toHaveBeenCalled();
  });
});

describe('GET /voices', () => {
  const get = (app: ReturnType<typeof make>['app']) => request(app).get(ENDPOINTS.voices).set(APP_TOKEN_HEADER, TEST_TOKEN);

  it('returns no voices and a null default when the server has no TTS provider', async () => {
    const res = await get(make().app);
    expect(res.status).toBe(200);
    expect(res.body as VoicesResponse).toEqual({ voices: [], defaultVoice: null });
  });

  it('lists the voices; the first is the default', async () => {
    const voices = [
      { id: 'voiceA', label: 'Warm' },
      { id: 'voiceB', label: 'Calm' },
    ];
    const res = await get(make({ voices }).app);
    expect(res.body as VoicesResponse).toEqual({ voices, defaultVoice: 'voiceA' });
  });

  it('requires the app token', async () => {
    expect((await request(make().app).get(ENDPOINTS.voices)).status).toBe(401);
  });

  it('exposes nothing but id and label', async () => {
    const res = await get(make({ voices: [{ id: 'v', label: 'L' }] }).app);
    expect(Object.keys(res.body).sort()).toEqual(['defaultVoice', 'voices']);
    expect(Object.keys(res.body.voices[0]).sort()).toEqual(['id', 'label']);
  });
});
