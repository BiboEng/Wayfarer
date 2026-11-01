import type { NearestLandmarkResponse } from '@shared/api/landmarks';
import type { NarrationResponse } from '@shared/api/narration';
import type { AppDeps } from '../app';
import { createMemoryBlobStore } from '../cache/memory-blob-store';
import type { ServerConfig } from '../config/env';
import type { Narrator } from '../narration/narrate';
import type { LandmarkLookup } from '../routes/landmarks';

export const TEST_TOKEN = 'test-token-0123456789abcdef';

/** A valid config with fake values only (no real keys). */
export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    appToken: TEST_TOKEN,
    rateLimitPerMinute: 1000,
    trustProxy: 0,
    contact: 'test@example.com',
    cachePath: null,
    overpassUrl: 'https://overpass.example.org/api/interpreter',
    openRouterApiKey: 'test-openrouter-key',
    openRouterModel: 'test/model',
    ttsProvider: 'none',
    elevenLabs: null,
    dailyLlmCallCap: 300,
    dailyTtsCharCap: 5000,
    audioDir: null,
    narrationRateLimitPerMinute: 1000,
    ...overrides,
  };
}

export const idleLandmarks: LandmarkLookup = {
  findNearby: () => Promise.resolve([]),
  findNearest: () => Promise.resolve<NearestLandmarkResponse>({ landmark: null, searchedRadiusMeters: 0 }),
};

export const idleNarrator: Narrator = {
  narrate: (request) =>
    Promise.resolve<NarrationResponse>({ landmarkId: request.landmarkId, text: 'A story.', audio: null, source: 'ai' }),
};

/** App dependencies that do nothing; tests override the part they care about. */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    landmarks: idleLandmarks,
    narrator: idleNarrator,
    blobs: createMemoryBlobStore(),
    tts: { voices: [] },
    ...overrides,
  };
}
