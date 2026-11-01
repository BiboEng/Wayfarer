import { describe, expect, it } from 'vitest';
import { createMemoryCacheStore } from '../../cache/memory-cache-store';
import { createCapStore } from '../create-cap-store';
import { createDailyCaps } from '../daily-caps';

describe('createCapStore', () => {
  it('reuses the shared store when a cache path is set', () => {
    const shared = createMemoryCacheStore();
    expect(createCapStore('./data/cache.sqlite', shared)).toBe(shared);
  });

  it('uses a separate store in memory mode', () => {
    const shared = createMemoryCacheStore();
    expect(createCapStore(null, shared)).not.toBe(shared);
  });

  it('keeps the cap counters when the shared memory cache fills up', async () => {
    const shared = createMemoryCacheStore({ maxEntries: 5 });
    const caps = createDailyCaps({ cache: createCapStore(null, shared), llmCalls: 1, ttsChars: 100, log: () => undefined });

    expect(await caps.tryReserve('llm', 1)).not.toBeNull();
    for (let i = 0; i < 50; i++) await shared.set(`landmark:${i}`, i, 60_000);
    expect(await caps.tryReserve('llm', 1)).toBeNull();
  });
});
