import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_TOKEN_HEADER, ENDPOINTS } from '@shared/api/endpoints';
import { isApiError } from '@shared/api/errors';
import type { NearbyLandmarksResponse, NearestLandmarkResponse } from '@shared/api/landmarks';
import { NEARBY_RADIUS_MAX_M, NEARBY_RADIUS_MIN_M } from '@shared/landmarks/search';
import { createApp } from '../../app';
import { TEST_TOKEN, testConfig, testDeps } from '../../__fixtures__/test-app';
import { LandmarkUpstreamError } from '../../landmarks/landmark-upstream-error';
import { wikiLandmark } from '../../landmarks/__fixtures__/builders';
import type { LandmarkLookup } from '../landmarks';

const TOKEN = TEST_TOKEN;

function makeLookup(overrides: Partial<LandmarkLookup> = {}) {
  const findNearby = vi.fn<LandmarkLookup['findNearby']>().mockResolvedValue([]);
  const findNearest = vi
    .fn<LandmarkLookup['findNearest']>()
    .mockResolvedValue({ landmark: null, searchedRadiusMeters: 10000 });
  const lookup: LandmarkLookup = { findNearby, findNearest, ...overrides };
  const app = createApp(testConfig(), testDeps({ landmarks: lookup }));
  return { app, findNearby, findNearest };
}

const get = (app: ReturnType<typeof makeLookup>['app'], path: string) =>
  request(app).get(path).set(APP_TOKEN_HEADER, TOKEN);

describe('GET /landmarks/nearby', () => {
  beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it('returns 200 with the landmarks and passes the parsed query to the lookup', async () => {
    const landmark = wikiLandmark();
    const { app, findNearby } = makeLookup();
    findNearby.mockResolvedValue([landmark]);

    const res = await get(app, `${ENDPOINTS.landmarksNearby}?lat=41.0086&lng=28.9802&radius=250`);

    expect(res.status).toBe(200);
    expect(res.body as NearbyLandmarksResponse).toEqual({ landmarks: [landmark] });
    expect(findNearby.mock.calls[0][0]).toEqual({ center: { lat: 41.0086, lng: 28.9802 }, radiusMeters: 250 });
    expect(findNearby.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it('returns 200 with an empty list when nothing is nearby', async () => {
    const res = await get(makeLookup().app, `${ENDPOINTS.landmarksNearby}?lat=0&lng=-30&radius=250`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ landmarks: [] });
  });

  it('accepts the boundary values', async () => {
    const { app } = makeLookup();
    for (const q of [
      `lat=90&lng=180&radius=${NEARBY_RADIUS_MAX_M}`,
      `lat=-90&lng=-180&radius=${NEARBY_RADIUS_MIN_M}`,
    ]) {
      expect((await get(app, `${ENDPOINTS.landmarksNearby}?${q}`)).status).toBe(200);
    }
  });

  it.each([
    ['missing everything', ''],
    ['missing lat', 'lng=1&radius=250'],
    ['missing lng', 'lat=1&radius=250'],
    ['missing radius', 'lat=1&lng=1'],
    ['non-numeric lat', 'lat=abc&lng=1&radius=250'],
    ['empty lat', 'lat=&lng=1&radius=250'],
    ['blank lng', 'lat=1&lng=%20&radius=250'],
    ['lat above 90', 'lat=90.1&lng=1&radius=250'],
    ['lat below -90', 'lat=-91&lng=1&radius=250'],
    ['lng above 180', 'lat=1&lng=181&radius=250'],
    ['radius below the minimum', `lat=1&lng=1&radius=${NEARBY_RADIUS_MIN_M - 1}`],
    ['radius above the maximum', `lat=1&lng=1&radius=${NEARBY_RADIUS_MAX_M + 1}`],
    ['infinite radius', 'lat=1&lng=1&radius=Infinity'],
    ['NaN lat', 'lat=NaN&lng=1&radius=250'],
    ['repeated lat', 'lat=1&lat=2&lng=1&radius=250'],
  ])('returns 400 BAD_REQUEST for %s', async (_label, query) => {
    const { app, findNearby } = makeLookup();
    const res = await get(app, `${ENDPOINTS.landmarksNearby}?${query}`);
    expect(res.status).toBe(400);
    expect(isApiError(res.body)).toBe(true);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(findNearby).not.toHaveBeenCalled();
  });

  it('returns 401 without the app token and never calls the lookup', async () => {
    const { app, findNearby } = makeLookup();
    const res = await request(app).get(`${ENDPOINTS.landmarksNearby}?lat=1&lng=1&radius=250`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(findNearby).not.toHaveBeenCalled();
  });

  it('returns 502 UPSTREAM_FAILED when the sources are down, without leaking details', async () => {
    const { app, findNearby } = makeLookup();
    findNearby.mockRejectedValue(new LandmarkUpstreamError('overpass', 'HTTP 503 at secret.example', 503));
    const res = await get(app, `${ENDPOINTS.landmarksNearby}?lat=1&lng=1&radius=250`);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
    expect(res.text).not.toContain('secret.example');
    expect(res.text).not.toContain('overpass');
  });

  it('returns 500 INTERNAL for unexpected errors', async () => {
    const { app, findNearby } = makeLookup();
    findNearby.mockRejectedValue(new Error('bug'));
    const res = await get(app, `${ENDPOINTS.landmarksNearby}?lat=1&lng=1&radius=250`);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
  });
});

describe('GET /landmarks/nearest', () => {
  beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it('returns 200 with the landmark and the searched radius', async () => {
    const landmark = wikiLandmark();
    const { app, findNearest } = makeLookup();
    findNearest.mockResolvedValue({ landmark, searchedRadiusMeters: 2000 });

    const res = await get(app, `${ENDPOINTS.landmarksNearest}?lat=41.0086&lng=28.9802`);

    expect(res.status).toBe(200);
    expect(res.body as NearestLandmarkResponse).toEqual({ landmark, searchedRadiusMeters: 2000 });
    expect(findNearest.mock.calls[0][0]).toEqual({ lat: 41.0086, lng: 28.9802 });
  });

  it('returns 200 with landmark null when nothing is found', async () => {
    const res = await get(makeLookup().app, `${ENDPOINTS.landmarksNearest}?lat=0&lng=-30`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ landmark: null, searchedRadiusMeters: 10000 });
  });

  it.each(['', 'lat=1', 'lng=1', 'lat=x&lng=1', 'lat=91&lng=1', 'lat=1&lng=-181', 'lat=&lng='])(
    'returns 400 for the query "%s"',
    async (query) => {
      const { app, findNearest } = makeLookup();
      const res = await get(app, `${ENDPOINTS.landmarksNearest}?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(findNearest).not.toHaveBeenCalled();
    },
  );

  it('ignores a radius parameter', async () => {
    const res = await get(makeLookup().app, `${ENDPOINTS.landmarksNearest}?lat=1&lng=1&radius=5`);
    expect(res.status).toBe(200);
  });

  it('returns 401 without the app token', async () => {
    const res = await request(makeLookup().app).get(`${ENDPOINTS.landmarksNearest}?lat=1&lng=1`);
    expect(res.status).toBe(401);
  });

  it('returns 502 UPSTREAM_FAILED when the lookup fails upstream', async () => {
    const { app, findNearest } = makeLookup();
    findNearest.mockRejectedValue(new LandmarkUpstreamError('landmarks', 'all sources failed'));
    const res = await get(app, `${ENDPOINTS.landmarksNearest}?lat=1&lng=1`);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });
});
