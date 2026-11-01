import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

import { pointsToFit } from '../fit-points';

const TAP: LatLng = { lat: 51.5, lng: -0.07 };

/** A point roughly `meters` north of `from`. */
const north = (from: LatLng, meters: number): LatLng => ({ lat: from.lat + meters / 111_320, lng: from.lng });

describe('pointsToFit', () => {
  it('returns the tap and the landmark when they are far apart', () => {
    const landmark = north(TAP, 5000);
    expect(pointsToFit(TAP, landmark)).toEqual([
      { latitude: TAP.lat, longitude: TAP.lng },
      { latitude: landmark.lat, longitude: landmark.lng },
    ]);
  });

  it('returns both points just beyond the 150 m threshold', () => {
    const landmark = north(TAP, 200);
    expect(distanceMeters(TAP, landmark)).toBeGreaterThan(150);
    expect(pointsToFit(TAP, landmark)).toHaveLength(2);
    expect(pointsToFit(TAP, landmark)[0]).toEqual({ latitude: TAP.lat, longitude: TAP.lng });
  });

  it.each([0, 50, 140])('returns a box around the landmark when the tap is %i m away', (meters) => {
    const landmark = north(TAP, meters);
    const [sw, ne] = pointsToFit(TAP, landmark);
    expect(sw.latitude).toBeLessThan(landmark.lat);
    expect(sw.longitude).toBeLessThan(landmark.lng);
    expect(ne.latitude).toBeGreaterThan(landmark.lat);
    expect(ne.longitude).toBeGreaterThan(landmark.lng);
    // Centred on the landmark.
    expect((sw.latitude + ne.latitude) / 2).toBeCloseTo(landmark.lat, 9);
    expect((sw.longitude + ne.longitude) / 2).toBeCloseTo(landmark.lng, 9);
  });

  it('makes the near-box big enough to avoid a maximum zoom (hundreds of metres)', () => {
    const [sw, ne] = pointsToFit(TAP, TAP);
    const diagonal = distanceMeters({ lat: sw.latitude, lng: sw.longitude }, { lat: ne.latitude, lng: ne.longitude });
    expect(diagonal).toBeGreaterThan(300);
    expect(diagonal).toBeLessThan(2000);
  });

  it('keeps the tap inside the near-box when it is within 150 m', () => {
    const landmark = north(TAP, 140);
    const [sw, ne] = pointsToFit(TAP, landmark);
    expect(TAP.lat).toBeGreaterThan(sw.latitude);
    expect(TAP.lat).toBeLessThan(ne.latitude);
  });
});
