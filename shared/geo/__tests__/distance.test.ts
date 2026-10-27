import { distanceMeters } from '../distance';

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };
const ISTANBUL = { lat: 41.0086, lng: 28.9802 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(LONDON, LONDON)).toBe(0);
  });

  it('matches known city distances', () => {
    expect(distanceMeters(LONDON, PARIS) / 1000).toBeCloseTo(343.5, -1); // within ~5 km
    expect(Math.abs(distanceMeters(LONDON, PARIS) / 1000 - 343.5)).toBeLessThan(2);
    expect(Math.abs(distanceMeters(LONDON, NEW_YORK) / 1000 - 5570)).toBeLessThan(20);
  });

  it('is symmetric', () => {
    expect(distanceMeters(LONDON, ISTANBUL)).toBeCloseTo(distanceMeters(ISTANBUL, LONDON), 6);
  });

  it('measures about 111.2 km per degree of latitude', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });

  it('shrinks degrees of longitude with latitude', () => {
    const equator = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const sixty = distanceMeters({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(sixty / equator).toBeCloseTo(0.5, 2);
  });

  it('gives half the Earth circumference for antipodes', () => {
    const half = Math.PI * 6_371_008.8;
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(half, -1);
    expect(distanceMeters({ lat: 45, lng: 10 }, { lat: -45, lng: -170 })).toBeCloseTo(half, -1);
    expect(distanceMeters({ lat: 90, lng: 0 }, { lat: -90, lng: 0 })).toBeCloseTo(half, -1);
  });

  it('handles the date line', () => {
    const across = distanceMeters({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 });
    expect(across).toBeCloseTo(111_195, -1);
  });

  it('is accurate at walking scale (about 100 m north)', () => {
    const d = distanceMeters(ISTANBUL, { lat: ISTANBUL.lat + 100 / 111_195, lng: ISTANBUL.lng });
    expect(d).toBeCloseTo(100, 1);
  });

  it('never returns NaN for near-antipodal rounding cases', () => {
    expect(Number.isNaN(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180.0000001 }))).toBe(false);
  });
});
