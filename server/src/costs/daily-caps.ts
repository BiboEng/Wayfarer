import type { CacheStore, Clock } from '../cache/cache-store';

export type CapKind = 'llm' | 'tts';

export interface DailyCaps {
  /**
   * Atomically checks the remaining budget and, if it fits, spends it.
   * Returns the UTC day the amount was booked on, or null when the cap is reached.
   */
  tryReserve(kind: CapKind, amount: number): Promise<string | null>;
  /** Gives back a reservation for a paid call that never went out. `day` is what tryReserve returned. */
  release(kind: CapKind, amount: number, day: string): Promise<void>;
}

export interface DailyCapsOptions {
  cache: CacheStore;
  /** LLM calls per UTC day. */
  llmCalls: number;
  /** TTS characters per UTC day. */
  ttsChars: number;
  now?: Clock;
  log?: (message: string) => void;
}

const COUNTER_TTL_MS = 48 * 60 * 60 * 1000;

/** UTC day, e.g. "2026-10-27". Counters reset when this changes. */
export function utcDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Daily spend counters stored in the CacheStore (so they survive restarts).
 * Operations run one at a time in this process, so two requests arriving
 * together cannot both slip under the limit.
 */
export function createDailyCaps(options: DailyCapsOptions): DailyCaps {
  const now = options.now ?? Date.now;
  const log = options.log ?? ((message: string) => console.warn(message));
  const limits: Record<CapKind, number> = { llm: options.llmCalls, tts: options.ttsChars };
  const unit: Record<CapKind, string> = { llm: 'LLM calls', tts: 'TTS characters' };
  const loggedToday = new Set<string>();
  let queue: Promise<unknown> = Promise.resolve();

  const key = (kind: CapKind, day: string): string => `cap:${kind}:${day}`;

  // Chain every operation so they never interleave their read-modify-write.
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    tryReserve(kind, amount) {
      return serial(async () => {
        const day = utcDay(now());
        const used = (await options.cache.get<number>(key(kind, day))) ?? 0;
        if (used + amount > limits[kind]) {
          const logKey = `${kind}:${day}`;
          if (!loggedToday.has(logKey)) {
            loggedToday.add(logKey);
            log(`[caps] Daily cap reached for ${unit[kind]} (${limits[kind]}) on ${day}; falling back.`);
          }
          return null;
        }
        await options.cache.set(key(kind, day), used + amount, COUNTER_TTL_MS);
        return day;
      });
    },
    release(kind, amount, day) {
      return serial(async () => {
        const used = (await options.cache.get<number>(key(kind, day))) ?? 0;
        await options.cache.set(key(kind, day), Math.max(0, used - amount), COUNTER_TTL_MS);
      });
    },
  };
}
