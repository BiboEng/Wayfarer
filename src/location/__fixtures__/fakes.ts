import type { BackgroundLocationSource, FixListener, LocationFix, LocationSource, TrackingOptions } from '../types';

export const WALK: TrackingOptions = { accuracy: 'high', distanceIntervalM: 10, timeIntervalMs: 3_000 };
export const DRIVE: TrackingOptions = { accuracy: 'high', distanceIntervalM: 30, timeIntervalMs: 5_000 };

export const fix = (lat: number, over: Partial<LocationFix> = {}): LocationFix => ({
  lat,
  lng: 0,
  accuracyM: 5,
  speedMps: null,
  headingDeg: null,
  timestamp: 1,
  ...over,
});

export interface Deferred {
  resolve(): void;
  reject(err: unknown): void;
  promise: Promise<void>;
}

export function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

/** A background source whose start/setOptions answers are controlled by hand. */
export function createFakeBackground() {
  const starts: Deferred[] = [];
  const setOptionsCalls: Deferred[] = [];
  let onFix: FixListener | null = null;
  const source: jest.Mocked<BackgroundLocationSource> = {
    start: jest.fn((_options: TrackingOptions, fixListener: FixListener) => {
      onFix = fixListener;
      const d = deferred();
      starts.push(d);
      return d.promise;
    }),
    setOptions: jest.fn((_options: TrackingOptions) => {
      const d = deferred();
      setOptionsCalls.push(d);
      return d.promise;
    }),
    stop: jest.fn(),
  };
  return { source, starts, setOptionsCalls, emit: (f: LocationFix) => onFix?.(f) };
}

/** A foreground watch source that records what it was asked to do. */
export function createFakeWatch() {
  let onFix: FixListener | null = null;
  const source: jest.Mocked<LocationSource> = {
    start: jest.fn((_o: TrackingOptions, fixListener: FixListener) => {
      onFix = fixListener;
    }),
    setOptions: jest.fn(),
    stop: jest.fn(),
  };
  return { source, emit: (f: LocationFix) => onFix?.(f) };
}

/** Lets resolved promises run. */
export const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
