import { distanceMeters } from '@shared/geo/distance';

import { bearingDeg, destinationPoint, normalizeDeg, relativeAngleDeg, sideOf, sideOfPlace } from '../bearing';
import { offsetM, ORIGIN } from '../__fixtures__/places';

describe('normalizeDeg', () => {
  it.each([
    [0, 0],
    [360, 0],
    [-10, 350],
    [725, 5],
    [-370, 350],
    [359.5, 359.5],
  ])('%d -> %d', (input, expected) => {
    expect(normalizeDeg(input)).toBeCloseTo(expected, 9);
  });
});

describe('bearingDeg', () => {
  it('is 0 to the north', () => expect(bearingDeg(ORIGIN, offsetM(ORIGIN, 500))).toBeCloseTo(0, 3));
  it('is 90 to the east', () => expect(bearingDeg(ORIGIN, offsetM(ORIGIN, 0, 500))).toBeCloseTo(90, 1));
  it('is 180 to the south', () => expect(bearingDeg(ORIGIN, offsetM(ORIGIN, -500))).toBeCloseTo(180, 3));
  it('is 270 to the west', () => expect(bearingDeg(ORIGIN, offsetM(ORIGIN, 0, -500))).toBeCloseTo(270, 1));
  it('is 45 to the north-east on a square-ish offset', () => {
    expect(bearingDeg(ORIGIN, offsetM(ORIGIN, 500, 500))).toBeCloseTo(45, 0);
  });
  it('stays within 0..360', () => {
    for (const [n, e] of [
      [10, -1],
      [-10, -1],
      [1, 10],
      [-1, -10],
    ]) {
      const b = bearingDeg(ORIGIN, offsetM(ORIGIN, n, e));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe('relativeAngleDeg', () => {
  it('wraps across north: heading 350, bearing 10 -> +20 (to the right)', () => {
    expect(relativeAngleDeg(350, 10)).toBeCloseTo(20, 9);
  });
  it('wraps the other way: heading 10, bearing 350 -> -20 (to the left)', () => {
    expect(relativeAngleDeg(10, 350)).toBeCloseTo(-20, 9);
  });
  it('is 0 when pointing straight at it', () => expect(relativeAngleDeg(123, 123)).toBe(0));
  it('is 180 (not -180) for directly behind', () => expect(relativeAngleDeg(0, 180)).toBe(180));
  it('positive means right: heading north, bearing east -> +90', () => expect(relativeAngleDeg(0, 90)).toBe(90));
});

describe('sideOf boundaries', () => {
  it.each([
    [0, 'ahead'],
    [30, 'ahead'],
    [-30, 'ahead'],
    [30.01, 'right'],
    [-30.01, 'left'],
    [90, 'right'],
    [-90, 'left'],
    [150, 'right'],
    [-150, 'left'],
    [150.01, 'behind'],
    [-150.01, 'behind'],
    [180, 'behind'],
  ] as const)('%d degrees -> %s', (angle, side) => {
    expect(sideOf(angle)).toBe(side);
  });
});

describe('sideOfPlace', () => {
  it('heading 350, place due north (bearing ~0) -> ahead (wrap at 0/360)', () => {
    expect(sideOfPlace(ORIGIN, 350, offsetM(ORIGIN, 200))).toBe('ahead');
  });
  it('heading 10, place due north -> ahead', () => {
    expect(sideOfPlace(ORIGIN, 10, offsetM(ORIGIN, 200))).toBe('ahead');
  });
  it('heading north: east is right, west is left, south is behind', () => {
    expect(sideOfPlace(ORIGIN, 0, offsetM(ORIGIN, 0, 200))).toBe('right');
    expect(sideOfPlace(ORIGIN, 0, offsetM(ORIGIN, 0, -200))).toBe('left');
    expect(sideOfPlace(ORIGIN, 0, offsetM(ORIGIN, -200))).toBe('behind');
  });
  it('heading south: east is left', () => {
    expect(sideOfPlace(ORIGIN, 180, offsetM(ORIGIN, 0, 200))).toBe('left');
  });
});

describe('destinationPoint', () => {
  it.each([0, 45, 90, 180, 270, 359])('goes the asked distance along bearing %d', (bearing) => {
    const to = destinationPoint(ORIGIN, bearing, 400);
    expect(distanceMeters(ORIGIN, to)).toBeCloseTo(400, 0);
    expect(bearingDeg(ORIGIN, to)).toBeCloseTo(bearing, 1);
  });

  it('0 m is the same point', () => {
    const to = destinationPoint(ORIGIN, 123, 0);
    expect(to.lat).toBeCloseTo(ORIGIN.lat, 9);
    expect(to.lng).toBeCloseTo(ORIGIN.lng, 9);
  });

  it('stays a valid longitude across the date line', () => {
    const to = destinationPoint({ lat: 0, lng: 179.999 }, 90, 1000);
    expect(to.lng).toBeGreaterThanOrEqual(-180);
    expect(to.lng).toBeLessThanOrEqual(180);
    expect(to.lng).toBeLessThan(0);
  });
});
