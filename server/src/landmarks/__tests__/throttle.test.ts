import { describe, expect, it, vi } from 'vitest';
import { createLimiter, defaultSleep } from '../throttle';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createLimiter', () => {
  it('runs tasks and returns their results', async () => {
    const limiter = createLimiter({ concurrency: 2, minIntervalMs: 0 });
    expect(await limiter.run(() => Promise.resolve(5))).toBe(5);
  });

  it('propagates task errors and keeps working afterwards', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await limiter.run(() => Promise.resolve('ok'))).toBe('ok');
  });

  it('never exceeds the concurrency', async () => {
    const limiter = createLimiter({ concurrency: 2, minIntervalMs: 0 });
    let active = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred());
    const runs = gates.map((gate) =>
      limiter.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await gate.promise;
        active -= 1;
      }),
    );
    for (const gate of gates) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      gate.resolve();
    }
    await Promise.all(runs);
    expect(peak).toBe(2);
  });

  it('starts queued tasks in order', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    const order: number[] = [];
    await Promise.all([1, 2, 3].map((n) => limiter.run(async () => void order.push(n))));
    expect(order).toEqual([1, 2, 3]);
  });

  it('spaces starts by the minimum interval using the injected clock and sleep', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const limiter = createLimiter({ concurrency: 3, minIntervalMs: 100, now: () => 1000, sleep });
    await Promise.all([1, 2, 3].map(() => limiter.run(() => Promise.resolve())));
    // With a frozen clock the 2nd start waits one interval and the 3rd waits two.
    expect(sleep.mock.calls.map((call) => (call as unknown[])[0])).toEqual([100, 200]);
  });

  it('does not sleep when enough time has already passed', async () => {
    let time = 0;
    const sleep = vi.fn(() => Promise.resolve());
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 100, now: () => time, sleep });
    await limiter.run(() => Promise.resolve());
    time = 500;
    await limiter.run(() => Promise.resolve());
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rejects without running the task when the signal is already aborted', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    const controller = new AbortController();
    controller.abort(new Error('gone'));
    const task = vi.fn(() => Promise.resolve(1));
    await expect(limiter.run(task, controller.signal)).rejects.toThrow('gone');
    expect(task).not.toHaveBeenCalled();
  });

  it('frees the slot when a task is aborted while waiting', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    const controller = new AbortController();
    controller.abort(new Error('gone'));
    await limiter.run(() => Promise.resolve(1), controller.signal).catch(() => undefined);
    expect(await limiter.run(() => Promise.resolve(2))).toBe(2);
  });
});

describe('createLimiter: queued tasks and abort', () => {
  it('removes a queued task from the queue when its signal aborts, without running it', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    const gate = deferred();
    const running = limiter.run(() => gate.promise);
    const controller = new AbortController();
    const queuedTask = vi.fn(() => Promise.resolve('never'));
    const queued = limiter.run(queuedTask, controller.signal).catch((e: unknown) => e);

    const reason = new Error('client left');
    controller.abort(reason);
    expect(await queued).toBe(reason); // rejects at once, while the slot is still taken
    gate.resolve();
    await running;
    expect(queuedTask).not.toHaveBeenCalled();
  });

  it('lets later queued tasks run after an aborted one left the queue', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    const gate = deferred();
    const running = limiter.run(() => gate.promise);
    const controller = new AbortController();
    const aborted = limiter.run(() => Promise.resolve('a'), controller.signal).catch(() => 'aborted');
    const later = limiter.run(() => Promise.resolve('later'));
    controller.abort(new Error('x'));
    gate.resolve();
    await running;
    expect(await aborted).toBe('aborted');
    expect(await later).toBe('later');
  });

  it('does not abort a task that is already running when its signal fires later', async () => {
    const limiter = createLimiter({ concurrency: 1, minIntervalMs: 0 });
    const controller = new AbortController();
    const result = limiter.run(async () => {
      controller.abort(new Error('late'));
      return 'finished';
    }, controller.signal);
    expect(await result).toBe('finished');
  });

  it('frees the slot for the next task after an abort during the interval wait', async () => {
    let time = 0;
    const limiter = createLimiter({
      concurrency: 1,
      minIntervalMs: 100,
      now: () => time,
      sleep: (_ms, signal) =>
        new Promise<void>((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason))),
    });
    await limiter.run(() => Promise.resolve(1));
    const controller = new AbortController();
    const waiting = limiter.run(() => Promise.resolve(2), controller.signal).catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 0));
    controller.abort(new Error('gone'));
    expect(((await waiting) as Error).message).toBe('gone');
    time = 10_000;
    expect(await limiter.run(() => Promise.resolve(3))).toBe(3);
  });
});

describe('defaultSleep', () => {
  it('resolves after the delay', async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const sleeping = defaultSleep(500).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(499);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      await sleeping;
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects early when aborted', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const sleeping = defaultSleep(10_000, controller.signal).catch((e: unknown) => e);
      controller.abort(new Error('stop'));
      expect(((await sleeping) as Error).message).toBe('stop');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects at once when already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already'));
    await expect(defaultSleep(10, controller.signal)).rejects.toThrow('already');
  });
});
