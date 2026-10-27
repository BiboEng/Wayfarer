import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_TOKEN_HEADER, ENDPOINTS } from '@shared/api/endpoints';
import { isApiError } from '@shared/api/errors';
import pkg from '../../package.json';
import { createApp } from '../app';
import type { ServerConfig } from '../config/env';
import type { LandmarkLookup } from '../routes/landmarks';

const TEST_TOKEN = 'test-token-0123456789abcdef';

/** Never reached by these tests; landmark routes have their own tests. */
const idleLandmarks: LandmarkLookup = {
  findNearby: () => Promise.resolve([]),
  findNearest: () => Promise.resolve({ landmark: null, searchedRadiusMeters: 0 }),
};

function makeApp(overrides: Partial<ServerConfig> = {}) {
  return createApp(
    {
      port: 0,
      host: '127.0.0.1',
      appToken: TEST_TOKEN,
      rateLimitPerMinute: 1000,
      trustProxy: 0,
      contact: 'test@example.com',
      cachePath: null,
      overpassUrl: 'https://overpass.example.org/api/interpreter',
      ...overrides,
    },
    { landmarks: idleLandmarks },
  );
}

function expectApiError(body: unknown, code: string): void {
  expect(isApiError(body)).toBe(true);
  expect((body as { error: { code: string } }).error.code).toBe(code);
}

function expectNoStackTrace(text: string): void {
  expect(text).not.toMatch(/\n\s+at\s/);
  expect(text).not.toMatch(/node_modules/);
  expect(text).not.toMatch(/\.(ts|js):\d+/);
  expect(text.toLowerCase()).not.toContain('stack');
}

describe('GET /health', () => {
  it('returns 200 with status ok and the package version, without a token', async () => {
    const res = await request(makeApp()).get(ENDPOINTS.health);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: pkg.version });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('also works when a token is sent', async () => {
    const res = await request(makeApp()).get(ENDPOINTS.health).set(APP_TOKEN_HEADER, TEST_TOKEN);
    expect(res.status).toBe(200);
  });
});

describe('app token protection', () => {
  it('rejects a protected route without a token with 401 UNAUTHORIZED', async () => {
    const res = await request(makeApp()).get('/api/does-not-exist');

    expect(res.status).toBe(401);
    expectApiError(res.body, 'UNAUTHORIZED');
  });

  it('rejects a wrong token with 401 UNAUTHORIZED', async () => {
    const res = await request(makeApp()).get('/api/does-not-exist').set(APP_TOKEN_HEADER, 'wrong-token');

    expect(res.status).toBe(401);
    expectApiError(res.body, 'UNAUTHORIZED');
  });

  it('does not echo the expected or provided token in the error body', async () => {
    const res = await request(makeApp()).get('/x').set(APP_TOKEN_HEADER, 'provided-secret-value');

    expect(res.text).not.toContain(TEST_TOKEN);
    expect(res.text).not.toContain('provided-secret-value');
  });

  it('lets the correct token through to the not-found handler (404 NOT_FOUND)', async () => {
    const res = await request(makeApp()).get('/api/does-not-exist').set(APP_TOKEN_HEADER, TEST_TOKEN);

    expect(res.status).toBe(404);
    expectApiError(res.body, 'NOT_FOUND');
  });

  it('applies to non-GET methods too', async () => {
    const res = await request(makeApp()).post('/anything').send({ a: 1 });

    expect(res.status).toBe(401);
    expectApiError(res.body, 'UNAUTHORIZED');
  });
});

describe('body parsing', () => {
  it('returns 400 BAD_REQUEST for malformed JSON with the correct token', async () => {
    const res = await request(makeApp())
      .post('/anything')
      .set(APP_TOKEN_HEADER, TEST_TOKEN)
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expectApiError(res.body, 'BAD_REQUEST');
    expectNoStackTrace(res.text);
  });

  it('does not echo the malformed body back', async () => {
    const res = await request(makeApp())
      .post('/anything')
      .set(APP_TOKEN_HEADER, TEST_TOKEN)
      .set('Content-Type', 'application/json')
      .send('{"secretField": nope}');

    expect(res.text).not.toContain('secretField');
  });

  it('rejects an oversized body (over 10kb) with a 4xx ApiError', async () => {
    const res = await request(makeApp())
      .post('/anything')
      .set(APP_TOKEN_HEADER, TEST_TOKEN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(20_000) }));

    expect(res.status).toBe(413);
    expectApiError(res.body, 'BAD_REQUEST');
  });
});

describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED once the per-minute limit is exceeded', async () => {
    const app = makeApp({ rateLimitPerMinute: 2 });

    const first = await request(app).get(ENDPOINTS.health);
    const second = await request(app).get(ENDPOINTS.health);
    const third = await request(app).get(ENDPOINTS.health);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expectApiError(third.body, 'RATE_LIMITED');
  });

  it('also rate limits unauthenticated requests before the token check', async () => {
    const app = makeApp({ rateLimitPerMinute: 1 });

    const first = await request(app).get('/x');
    const second = await request(app).get('/x');

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expectApiError(second.body, 'RATE_LIMITED');
  });

  it('keeps separate counters per app instance', async () => {
    const a = makeApp({ rateLimitPerMinute: 1 });
    const b = makeApp({ rateLimitPerMinute: 1 });

    await request(a).get(ENDPOINTS.health);
    expect((await request(a).get(ENDPOINTS.health)).status).toBe(429);
    expect((await request(b).get(ENDPOINTS.health)).status).toBe(200);
  });
});

describe('response hardening', () => {
  it('does not send an x-powered-by header', async () => {
    const app = makeApp();
    const health = await request(app).get(ENDPOINTS.health);
    const unauthorized = await request(app).get('/x');
    const notFound = await request(app).get('/x').set(APP_TOKEN_HEADER, TEST_TOKEN);

    for (const res of [health, unauthorized, notFound]) {
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('error responses contain only { error: { code, message } } and no stack traces', async () => {
    const app = makeApp({ rateLimitPerMinute: 4 });
    // Every request counts toward the limit: the limiter runs first.
    const responses = [
      await request(app).get('/x'),
      await request(app).get('/x').set(APP_TOKEN_HEADER, TEST_TOKEN),
      await request(app)
        .post('/x')
        .set(APP_TOKEN_HEADER, TEST_TOKEN)
        .set('Content-Type', 'application/json')
        .send('{bad'),
      await request(app).get('/x'), // 4th request, still within limit
      await request(app).get('/x'), // 5th request: rate limited
    ];

    expect(responses.map((r) => r.status)).toEqual([401, 404, 400, 401, 429]);
    for (const res of responses) {
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message']);
      expectNoStackTrace(res.text);
    }
  });
});

describe('middleware order regressions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts tokenless malformed-JSON POSTs toward the rate limit and never returns 400 for them', async () => {
    const app = makeApp({ rateLimitPerMinute: 2 });
    const post = () =>
      request(app).post('/anything').set('Content-Type', 'application/json').send('{"broken": ');

    const responses = [await post(), await post(), await post()];

    expect(responses.map((r) => r.status)).toEqual([401, 401, 429]);
    expectApiError(responses[0].body, 'UNAUTHORIZED');
    expectApiError(responses[2].body, 'RATE_LIMITED');
    expect(responses.some((r) => r.status === 400)).toBe(false);
    // Unauthenticated bodies are never parsed, so nothing is logged as a parse error.
    expect(console.error).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed-JSON POST with the token and logs no request body text', async () => {
    const res = await request(makeApp())
      .post('/anything')
      .set(APP_TOKEN_HEADER, TEST_TOKEN)
      .set('Content-Type', 'application/json')
      .send('{"secretField": "private-body-text", oops}');

    expect(res.status).toBe(400);
    expectApiError(res.body, 'BAD_REQUEST');

    const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logged).toContain('POST /anything -> 400 BAD_REQUEST (entity.parse.failed)');
    expect(logged).not.toContain('secretField');
    expect(logged).not.toContain('private-body-text');
    expect(logged).not.toContain('oops');
    expect(logged).not.toContain(TEST_TOKEN);
  });
});
