import type { FixListener, LocationFix, LocationSource, TrackingOptions } from '@/location/types';

import { offsetM, ORIGIN } from './places';

/** A LocationSource driven by hand: call `emit` to deliver a fix. */
export function createFakeLocationSource() {
  let listener: FixListener | null = null;
  const optionHistory: TrackingOptions[] = [];
  const source: LocationSource = {
    start: jest.fn((options: TrackingOptions, onFix: FixListener) => {
      optionHistory.push(options);
      listener = onFix;
    }),
    setOptions: jest.fn((options: TrackingOptions) => {
      optionHistory.push(options);
    }),
    stop: jest.fn(() => {
      listener = null;
    }),
  };
  return {
    source,
    optionHistory,
    isWatching: () => listener !== null,
    /** Delivers a fix; ignored (like a stopped watch) when not started. */
    emit(fix: LocationFix) {
      listener?.(fix);
    },
    /** Delivers a fix even after stop, as a late callback from the platform would. */
    emitLate(fix: LocationFix, to: FixListener | null) {
      to?.(fix);
    },
  };
}

/** A walking fix `northM` meters north of ORIGIN at `timestamp`. */
export function walkingFix(northM: number, timestamp: number, over: Partial<LocationFix> = {}): LocationFix {
  const { lat, lng } = offsetM(ORIGIN, northM);
  return { lat, lng, accuracyM: 5, speedMps: 1.4, headingDeg: null, timestamp, ...over };
}
