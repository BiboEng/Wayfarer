import { describe, expect, it } from 'vitest';
import { estimateLlmUsd, estimateTtsUsd } from '../estimate';

describe('estimateTtsUsd', () => {
  it('prices characters at the Flash rate', () => {
    expect(estimateTtsUsd(1000)).toBeCloseTo(0.05, 10);
    expect(estimateTtsUsd(0)).toBe(0);
  });
});

describe('estimateLlmUsd', () => {
  it('matches what OpenRouter reported for a real flash-lite call', () => {
    expect(estimateLlmUsd('google/gemini-2.5-flash-lite', 807, 158)).toBeCloseTo(0.0001439, 10);
  });

  it('returns undefined for a model it has no price for', () => {
    expect(estimateLlmUsd('some/other-model', 807, 158)).toBeUndefined();
  });
});
