import { ENDPOINTS } from '@shared/api/endpoints';

import { getNearbyLandmarks, getNearestLandmark } from '../landmarks';

// The real instance reads EXPO_PUBLIC_* config; replace it with a fake client.
const mockGet = jest.fn();
jest.mock('../instance', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

beforeEach(() => mockGet.mockReset());

describe('getNearbyLandmarks', () => {
  it('uses the default client timeout (no per-call override)', async () => {
    mockGet.mockResolvedValue({ ok: true, data: { landmarks: [] } });
    await getNearbyLandmarks({ lat: 1, lng: 2 }, 100);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0]).toHaveLength(1);
  });

  it('requests /landmarks/nearby with lat, lng and radius', async () => {
    mockGet.mockResolvedValue({ ok: true, data: { landmarks: [] } });

    const result = await getNearbyLandmarks({ lat: 41.0086, lng: 28.9802 }, 250);

    expect(mockGet).toHaveBeenCalledWith(`${ENDPOINTS.landmarksNearby}?lat=41.0086&lng=28.9802&radius=250`);
    expect(result).toEqual({ ok: true, data: { landmarks: [] } });
  });

  it('passes error results through untouched', async () => {
    const failure = { ok: false, error: { code: 'UPSTREAM_FAILED', message: 'down' } };
    mockGet.mockResolvedValue(failure);
    expect(await getNearbyLandmarks({ lat: 1, lng: 2 }, 100)).toBe(failure);
  });
});

describe('getNearestLandmark', () => {
  it('requests /landmarks/nearest with lat and lng only', async () => {
    mockGet.mockResolvedValue({ ok: true, data: { landmark: null, searchedRadiusMeters: 10000 } });

    const result = await getNearestLandmark({ lat: 0, lng: -30 });

    expect(mockGet).toHaveBeenCalledWith(`${ENDPOINTS.landmarksNearest}?lat=0&lng=-30`, { timeoutMs: 20_000 });
    expect(result).toEqual({ ok: true, data: { landmark: null, searchedRadiusMeters: 10000 } });
  });

  it('passes error results through untouched', async () => {
    const failure = { ok: false, error: { code: 'TIMEOUT', message: 'slow' } };
    mockGet.mockResolvedValue(failure);
    expect(await getNearestLandmark({ lat: 1, lng: 2 })).toBe(failure);
  });
});
