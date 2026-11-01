import { ENDPOINTS } from '@shared/api/endpoints';
import type { NarrationRequest } from '@shared/api/narration';

import { getVoices, requestNarration } from '../narration';

// The real instance reads EXPO_PUBLIC_* config; replace it with a fake client.
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../instance', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

const REQUEST: NarrationRequest = { landmarkId: 'wiki:42764', length: 'medium', travelMode: 'walking', voice: 'voiceA' };

describe('requestNarration', () => {
  it('POSTs the request to /narrations with a 45 second timeout', async () => {
    const data = { landmarkId: 'wiki:42764', text: 'A story.', audio: null, source: 'ai' };
    mockPost.mockResolvedValue({ ok: true, data });

    const result = await requestNarration(REQUEST);

    expect(mockPost).toHaveBeenCalledWith(ENDPOINTS.narrations, REQUEST, { timeoutMs: 45_000 });
    expect(result).toEqual({ ok: true, data });
  });

  it('sends only the request fields it was given (no text from the app)', async () => {
    mockPost.mockResolvedValue({ ok: true, data: {} });
    await requestNarration({ landmarkId: 'wiki:1', length: 'short', travelMode: 'driving' });
    expect(Object.keys(mockPost.mock.calls[0][1] as object).sort()).toEqual(['landmarkId', 'length', 'travelMode']);
  });

  it.each(['NOT_NARRATABLE', 'RATE_LIMITED', 'TIMEOUT', 'UPSTREAM_FAILED'])('passes the %s error through untouched', async (code) => {
    const failure = { ok: false, error: { code, message: 'x' } };
    mockPost.mockResolvedValue(failure);
    expect(await requestNarration(REQUEST)).toBe(failure);
  });
});

describe('getVoices', () => {
  it('GETs /voices with the default timeout', async () => {
    const data = { voices: [{ id: 'a', label: 'A' }], defaultVoice: 'a' };
    mockGet.mockResolvedValue({ ok: true, data });

    const result = await getVoices();

    expect(mockGet).toHaveBeenCalledWith(ENDPOINTS.voices);
    expect(result).toEqual({ ok: true, data });
  });

  it('passes errors through', async () => {
    const failure = { ok: false, error: { code: 'NETWORK_ERROR', message: 'x' } };
    mockGet.mockResolvedValue(failure);
    expect(await getVoices()).toBe(failure);
  });
});
