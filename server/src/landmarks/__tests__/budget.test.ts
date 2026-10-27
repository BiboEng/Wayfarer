import { describe, expect, it, vi } from 'vitest';
import { FIND_NEARBY_BUDGET_MS, NEAREST_BUDGET_MS, OVERPASS_MAX_CALL_MS, remainingMs, withTimeout } from '../budget';

describe('budget constants', () => {
  it('fit inside what the app waits for', () => {
    expect(FIND_NEARBY_BUDGET_MS).toBe(8_000); // the app waits 10 s for /landmarks/nearby
    expect(NEAREST_BUDGET_MS).toBe(16_000); // the app waits 20 s for /landmarks/nearest
    expect(OVERPASS_MAX_CALL_MS).toBeLessThan(FIND_NEARBY_BUDGET_MS);
  });
});

describe('withTimeout', () => {
  it('aborts after the given time', async () => {
    const signal = withTimeout(20);
    expect(signal.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    expect(signal.aborted).toBe(true);
  });

  it('asks AbortSignal.timeout for the (floored) milliseconds', () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      withTimeout(1500.9);
      expect(spy).toHaveBeenCalledWith(1500);
    } finally {
      spy.mockRestore();
    }
  });

  it('never passes zero or negative durations (at least 1 ms)', () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      withTimeout(0);
      withTimeout(-50);
      expect(spy).toHaveBeenNthCalledWith(1, 1);
      expect(spy).toHaveBeenNthCalledWith(2, 1);
    } finally {
      spy.mockRestore();
    }
  });

  it('aborts when the caller signal aborts, carrying its reason', () => {
    const caller = new AbortController();
    const signal = withTimeout(60_000, caller.signal);
    expect(signal.aborted).toBe(false);
    const reason = new Error('client left');
    caller.abort(reason);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
  });

  it('is already aborted when the caller signal already was', () => {
    const caller = new AbortController();
    caller.abort(new Error('early'));
    expect(withTimeout(60_000, caller.signal).aborted).toBe(true);
  });

  it('aborts on timeout even with a live caller signal', async () => {
    const caller = new AbortController();
    const signal = withTimeout(20, caller.signal);
    await new Promise((r) => setTimeout(r, 80));
    expect(signal.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
  });
});

describe('remainingMs', () => {
  it('returns the time left until the deadline', () => {
    expect(remainingMs(1_000, () => 400)).toBe(600);
  });

  it('is 0 at and after the deadline, never negative', () => {
    expect(remainingMs(1_000, () => 1_000)).toBe(0);
    expect(remainingMs(1_000, () => 5_000)).toBe(0);
  });

  it('uses Date.now by default', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10_000);
      expect(remainingMs(12_500)).toBe(2_500);
    } finally {
      vi.useRealTimers();
    }
  });
});
