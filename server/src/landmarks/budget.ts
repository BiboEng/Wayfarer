/** Overall time one findNearby may take; the app waits 10 s for /landmarks/nearby. */
export const FIND_NEARBY_BUDGET_MS = 8_000;
/** One Overpass call never runs longer than this, whatever budget is left. */
export const OVERPASS_MAX_CALL_MS = 6_000;
/** Whole /landmarks/nearest search (4 steps); the app waits 20 s. */
export const NEAREST_BUDGET_MS = 16_000;

/** A signal that aborts when the caller's does or after `ms`, whichever comes first. */
export function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(Math.max(1, Math.floor(ms)));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export function remainingMs(deadlineAt: number, now: () => number = Date.now): number {
  return Math.max(0, deadlineAt - now());
}
