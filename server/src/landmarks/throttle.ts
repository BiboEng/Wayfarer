export type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;

/** Real sleep that wakes early (rejecting) when the signal aborts. */
export const defaultSleep: SleepFn = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export interface LimiterOptions {
  /** Tasks allowed to run at the same time. */
  concurrency: number;
  /** Minimum gap between the starts of two tasks. */
  minIntervalMs: number;
  now?: () => number;
  sleep?: SleepFn;
}

export interface Limiter {
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>;
}

/** Per-upstream throttle: bounded concurrency plus a minimum start interval. */
export function createLimiter(options: LimiterOptions): Limiter {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const queue: Array<() => void> = [];
  let active = 0;
  let nextStartAt = 0;

  const pump = (): void => {
    while (active < options.concurrency) {
      const start = queue.shift();
      if (!start) return;
      active += 1;
      start();
    }
  };

  return {
    run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        // A task still waiting in the queue leaves it as soon as its signal aborts.
        const onQueuedAbort = () => {
          const index = queue.indexOf(start);
          if (index < 0) return;
          queue.splice(index, 1);
          reject(signal?.reason);
        };
        const start = () => {
          signal?.removeEventListener('abort', onQueuedAbort);
          const current = now();
          const wait = Math.max(0, nextStartAt - current);
          nextStartAt = current + wait + options.minIntervalMs;
          void (async () => {
            try {
              if (wait > 0) await sleep(wait, signal);
              signal?.throwIfAborted();
              resolve(await task());
            } catch (error) {
              reject(error);
            } finally {
              active -= 1;
              pump();
            }
          })();
        };
        queue.push(start);
        signal?.addEventListener('abort', onQueuedAbort, { once: true });
        pump();
      });
    },
  };
}
