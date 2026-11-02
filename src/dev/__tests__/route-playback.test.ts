import { distanceMeters } from '@shared/geo/distance';

import { offsetM, ORIGIN } from '@/tour/__fixtures__/places';
import { bearingDeg } from '@/tour/bearing';

import { fixAt, prepareRoute, routeDurationMs } from '../route-playback';
import { DRIVE_BOSPHORUS, simRouteFor, WALK_SULTANAHMET } from '../routes';
import type { SimRoute } from '../sim-route';

/** 100 m due north, then 100 m due east, at 10 m/s: 20 s long. */
const L_ROUTE: SimRoute = {
  name: 'L',
  speedMps: 10,
  points: [ORIGIN, offsetM(ORIGIN, 100), offsetM(offsetM(ORIGIN, 100), 0, 100)],
};
const START = 1_000_000;
const opts = { startedAt: START };

describe('prepareRoute', () => {
  it('measures the total length and the distance to each point', () => {
    const route = prepareRoute(L_ROUTE);
    expect(route.cumulativeM[0]).toBe(0);
    expect(route.cumulativeM[1]).toBeCloseTo(100, 0);
    expect(route.totalM).toBeCloseTo(200, 0);
    expect(routeDurationMs(route)).toBeCloseTo(20_000, -2);
  });

  it('needs at least two points', () => {
    expect(() => prepareRoute({ name: 'x', speedMps: 1, points: [ORIGIN] })).toThrow();
  });
});

describe('fixAt', () => {
  const route = prepareRoute(L_ROUTE);

  it('at t=0 is at the first point, moving at the profile speed, heading along the first segment', () => {
    const { fix, finished } = fixAt(route, 0, opts);
    expect(finished).toBe(false);
    expect(fix.lat).toBeCloseTo(ORIGIN.lat, 7);
    expect(fix.lng).toBeCloseTo(ORIGIN.lng, 7);
    expect(fix.speedMps).toBe(10);
    expect(fix.headingDeg).toBeCloseTo(0, 1); // north
    expect(fix.timestamp).toBe(START);
  });

  it('partway is on the segment at the right distance', () => {
    const { fix } = fixAt(route, 5000, opts); // 50 m
    expect(distanceMeters(ORIGIN, fix)).toBeCloseTo(50, 0);
    expect(fix.lng).toBeCloseTo(ORIGIN.lng, 7);
    expect(fix.timestamp).toBe(START + 5000);
  });

  it('the heading follows the segment: east on the second leg', () => {
    const { fix } = fixAt(route, 15_000, opts);
    expect(fix.headingDeg).toBeCloseTo(90, 0);
    expect(distanceMeters(offsetM(ORIGIN, 100), fix)).toBeCloseTo(50, 0);
  });

  it('the heading equals the bearing of the current segment', () => {
    const { fix } = fixAt(route, 12_000, opts);
    expect(fix.headingDeg).toBeCloseTo(bearingDeg(route.points[1], route.points[2]), 6);
  });

  it('at the end is at the last point, finished, stopped, with no heading', () => {
    const { fix, finished } = fixAt(route, 20_000, opts);
    expect(finished).toBe(true);
    expect(fix.lat).toBeCloseTo(route.points[2].lat, 7);
    expect(fix.lng).toBeCloseTo(route.points[2].lng, 7);
    expect(fix.speedMps).toBe(0);
    expect(fix.headingDeg).toBeNull();
  });

  it('after the end it stays at the last point', () => {
    const { fix, finished } = fixAt(route, 999_000, opts);
    expect(finished).toBe(true);
    expect(fix.lat).toBeCloseTo(route.points[2].lat, 7);
    expect(fix.lng).toBeCloseTo(route.points[2].lng, 7);
  });

  it('before the start (negative time) stays at the first point', () => {
    const { fix } = fixAt(route, -500, opts);
    expect(fix.lat).toBeCloseTo(ORIGIN.lat, 7);
    expect(fix.timestamp).toBe(START);
  });

  it('reports the accuracy asked for, 5 m by default', () => {
    expect(fixAt(route, 0, opts).fix.accuracyM).toBe(5);
    expect(fixAt(route, 0, { ...opts, accuracyM: 12 }).fix.accuracyM).toBe(12);
  });

  it('has no jitter by default', () => {
    expect(fixAt(route, 5000, opts).fix).toEqual(fixAt(route, 5000, opts).fix);
    expect(distanceMeters(ORIGIN, fixAt(route, 5000, opts).fix)).toBeCloseTo(50, 0);
  });

  it('skips a repeated point without breaking', () => {
    const dup = prepareRoute({ name: 'd', speedMps: 10, points: [ORIGIN, ORIGIN, offsetM(ORIGIN, 100)] });
    const { fix } = fixAt(dup, 5000, opts);
    expect(distanceMeters(ORIGIN, fix)).toBeCloseTo(50, 0);
    expect(fix.headingDeg).toBeCloseTo(0, 1);
  });
});

describe('jitter', () => {
  const route = prepareRoute(L_ROUTE);

  it('is deterministic for a given seed and time', () => {
    const a = fixAt(route, 5000, { ...opts, jitterM: 5, seed: 42 });
    const b = fixAt(route, 5000, { ...opts, jitterM: 5, seed: 42 });
    expect(a).toEqual(b);
  });

  it('differs between seeds and between times', () => {
    const base = fixAt(route, 5000, { ...opts, jitterM: 5, seed: 42 }).fix;
    expect(fixAt(route, 5000, { ...opts, jitterM: 5, seed: 43 }).fix).not.toEqual(base);
    expect(fixAt(route, 5001, { ...opts, jitterM: 5, seed: 42 }).fix).not.toEqual(base);
  });

  it('stays within the jitter radius of the true position (per axis)', () => {
    const clean = fixAt(route, 5000, opts).fix;
    for (let seed = 1; seed <= 30; seed++) {
      const noisy = fixAt(route, 5000, { ...opts, jitterM: 4, seed }).fix;
      expect(distanceMeters(clean, noisy)).toBeLessThanOrEqual(4 * Math.SQRT2 + 0.01);
    }
  });
});

describe('the bundled routes', () => {
  it('are picked by tour source; real GPS has none', () => {
    expect(simRouteFor('sim-walk')).toBe(WALK_SULTANAHMET);
    expect(simRouteFor('sim-drive')).toBe(DRIVE_BOSPHORUS);
    expect(simRouteFor('gps')).toBeNull();
  });

  it('the walk goes at 5 km/h for about 2 km', () => {
    const route = prepareRoute(WALK_SULTANAHMET);
    expect(route.speedMps).toBeCloseTo(5 / 3.6, 6);
    expect(route.totalM).toBeGreaterThan(1500);
    expect(route.totalM).toBeLessThan(2500);
  });

  it('the drive goes at 40 km/h for several km', () => {
    const route = prepareRoute(DRIVE_BOSPHORUS);
    expect(route.speedMps).toBeCloseTo(40 / 3.6, 6);
    expect(route.totalM).toBeGreaterThan(4000);
    expect(route.totalM).toBeLessThan(8000);
  });

  it.each([WALK_SULTANAHMET, DRIVE_BOSPHORUS])('$name has no jumps and no repeated points', (route) => {
    for (let i = 1; i < route.points.length; i++) {
      const d = distanceMeters(route.points[i - 1], route.points[i]);
      expect(d).toBeGreaterThan(1);
      expect(d).toBeLessThan(700);
    }
  });

  it.each([WALK_SULTANAHMET, DRIVE_BOSPHORUS])('$name plays through to the end', (route) => {
    const prepared = prepareRoute(route);
    expect(fixAt(prepared, routeDurationMs(prepared) + 1, opts).finished).toBe(true);
    expect(fixAt(prepared, routeDurationMs(prepared) - 1000, opts).finished).toBe(false);
  });
});
