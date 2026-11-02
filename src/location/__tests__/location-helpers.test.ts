import type { LocationObject } from 'expo-location';

import { toLocationFix } from '../to-location-fix';
import { TRACKING_OPTIONS, trackingOptionsFor } from '../tracking-options';

function position(coords: Partial<LocationObject['coords']> = {}, timestamp = 1_700_000_000_000): LocationObject {
  return {
    timestamp,
    coords: {
      latitude: 41.01,
      longitude: 28.98,
      altitude: null,
      accuracy: 8,
      altitudeAccuracy: null,
      heading: 90,
      speed: 1.4,
      ...coords,
    },
  };
}

describe('toLocationFix', () => {
  it('copies position, accuracy, speed, heading and time', () => {
    expect(toLocationFix(position())).toEqual({ lat: 41.01, lng: 28.98, accuracyM: 8, speedMps: 1.4, headingDeg: 90, timestamp: 1_700_000_000_000 });
  });

  it('an unknown accuracy becomes Infinity', () => {
    expect(toLocationFix(position({ accuracy: null })).accuracyM).toBe(Infinity);
  });

  it('a speed of 0 is real; a negative or missing speed is unknown', () => {
    expect(toLocationFix(position({ speed: 0 })).speedMps).toBe(0);
    expect(toLocationFix(position({ speed: -1 })).speedMps).toBeNull();
    expect(toLocationFix(position({ speed: null })).speedMps).toBeNull();
  });

  it('a heading of 0 is real; a negative or missing heading is unknown', () => {
    expect(toLocationFix(position({ heading: 0 })).headingDeg).toBe(0);
    expect(toLocationFix(position({ heading: -1 })).headingDeg).toBeNull();
    expect(toLocationFix(position({ heading: null })).headingDeg).toBeNull();
  });
});

describe('trackingOptionsFor', () => {
  it('walking: high accuracy, an update every 10 m / 3 s', () => {
    expect(trackingOptionsFor('walking')).toEqual({ accuracy: 'high', distanceIntervalM: 10, timeIntervalMs: 3000 });
  });

  it('driving: high accuracy, an update every 30 m / 5 s', () => {
    expect(trackingOptionsFor('driving')).toEqual({ accuracy: 'high', distanceIntervalM: 30, timeIntervalMs: 5000 });
  });

  it('never goes below high accuracy (lower gives unusable headings)', () => {
    expect(Object.values(TRACKING_OPTIONS).every((o) => o.accuracy === 'high')).toBe(true);
  });
});
