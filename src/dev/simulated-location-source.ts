/**
 * Plays a route back in real time as a LocationSource, so the simulator feeds the same pipeline
 * as GPS. Emits once right away, then every `timeIntervalMs`; stops emitting after the end.
 * No React or Expo imports (timers only), so it can be tested with fake timers.
 */
import type { FixListener, LocationSource, TrackingOptions } from '@/location/types';

import { fixAt, prepareRoute, type PreparedRoute } from './route-playback';
import type { SimRoute } from './sim-route';

export interface SimulatedSourceOptions {
  /** Small position noise, so the pipeline sees GPS-like fixes. */
  jitterM?: number;
  seed?: number;
  now?: () => number;
}

const DEFAULT_JITTER_M = 2;

export function createSimulatedLocationSource(route: SimRoute, options: SimulatedSourceOptions = {}): LocationSource {
  const prepared: PreparedRoute = prepareRoute(route);
  const now = options.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | undefined;
  let kickoff: ReturnType<typeof setTimeout> | undefined;
  let startedAt = 0;
  let onFix: FixListener | null = null;

  function clearTimers(): void {
    clearInterval(timer);
    clearTimeout(kickoff);
    timer = undefined;
    kickoff = undefined;
  }

  function emit(): void {
    if (!onFix) return;
    const { fix, finished } = fixAt(prepared, now() - startedAt, {
      startedAt,
      jitterM: options.jitterM ?? DEFAULT_JITTER_M,
      seed: options.seed,
    });
    onFix(fix);
    if (finished) clearTimers();
  }

  function schedule(tracking: TrackingOptions): void {
    clearTimers();
    // Never call back synchronously from start().
    kickoff = setTimeout(emit, 0);
    timer = setInterval(emit, tracking.timeIntervalMs);
  }

  return {
    start(tracking, listener) {
      onFix = listener;
      startedAt = now();
      schedule(tracking);
    },
    setOptions(tracking) {
      // Keeps the elapsed time: only the update rate changes.
      if (onFix) schedule(tracking);
    },
    stop() {
      clearTimers();
      onFix = null;
    },
  };
}
