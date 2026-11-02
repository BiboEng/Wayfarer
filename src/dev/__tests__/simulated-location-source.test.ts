import type { LocationFix, TrackingOptions } from '@/location/types';
import { offsetM, ORIGIN } from '@/tour/__fixtures__/places';

import { createSimulatedLocationSource } from '../simulated-location-source';
import type { SimRoute } from '../sim-route';

/** 100 m north at 10 m/s: 10 s long. */
const ROUTE: SimRoute = { name: 'N', speedMps: 10, points: [ORIGIN, offsetM(ORIGIN, 100)] };
const every = (timeIntervalMs: number): TrackingOptions => ({ accuracy: 'high', distanceIntervalM: 10, timeIntervalMs });

function setup() {
  const source = createSimulatedLocationSource(ROUTE, { jitterM: 0, now: () => Date.now() });
  const fixes: LocationFix[] = [];
  return { source, fixes, onFix: (fix: LocationFix) => fixes.push(fix) };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
});
afterEach(() => {
  jest.useRealTimers();
});

describe('createSimulatedLocationSource', () => {
  it('never calls back synchronously from start', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    expect(fixes).toEqual([]);
  });

  it('emits once right away (next tick), then on every interval', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    jest.advanceTimersByTime(0);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].lat).toBeCloseTo(ORIGIN.lat, 7);
    jest.advanceTimersByTime(3000);
    expect(fixes).toHaveLength(2);
    jest.advanceTimersByTime(3000);
    expect(fixes).toHaveLength(3);
  });

  it('moves along the route in real time at the route speed', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    jest.advanceTimersByTime(6000);
    const last = fixes[fixes.length - 1];
    expect(last.speedMps).toBe(10);
    expect(last.lat).toBeCloseTo(offsetM(ORIGIN, 60).lat, 5);
    expect(last.timestamp - fixes[0].timestamp).toBe(6000);
  });

  it('stops after the end of the route, with a last fix that is finished and stopped', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    jest.advanceTimersByTime(60_000);
    const last = fixes[fixes.length - 1];
    expect(last.speedMps).toBe(0);
    expect(last.lat).toBeCloseTo(offsetM(ORIGIN, 100).lat, 5);
    const count = fixes.length;
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(fixes).toHaveLength(count);
  });

  it('stop ends the emissions and leaves no timers behind', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    jest.advanceTimersByTime(3000);
    const count = fixes.length;
    source.stop();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(30_000);
    expect(fixes).toHaveLength(count);
  });

  it('stop before the first tick means no fix at all', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    source.stop();
    jest.advanceTimersByTime(10_000);
    expect(fixes).toEqual([]);
  });

  it('setOptions changes the rate and keeps the elapsed route time', () => {
    const { source, fixes, onFix } = setup();
    source.start(every(3000), onFix);
    jest.advanceTimersByTime(3000);
    source.setOptions(every(5000));
    fixes.length = 0;
    jest.advanceTimersByTime(0);
    jest.advanceTimersByTime(5000);
    const last = fixes[fixes.length - 1];
    expect(last.lat).toBeCloseTo(offsetM(ORIGIN, 80).lat, 5); // 3 s + 5 s at 10 m/s
  });

  it('setOptions before start or after stop does nothing', () => {
    const { source, fixes, onFix } = setup();
    source.setOptions(every(1000));
    source.start(every(3000), onFix);
    source.stop();
    source.setOptions(every(1000));
    jest.advanceTimersByTime(10_000);
    expect(fixes).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('adds small noise by default but is repeatable with a seed', () => {
    const run = () => {
      const source = createSimulatedLocationSource(ROUTE, { seed: 7, now: () => Date.now() });
      const fixes: LocationFix[] = [];
      source.start(every(3000), (fix) => fixes.push(fix));
      jest.advanceTimersByTime(3000);
      source.stop();
      return fixes;
    };
    jest.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    const a = run();
    jest.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    const b = run();
    expect(a).toEqual(b);
    expect(a[0].lat).not.toBe(ORIGIN.lat);
  });
});
