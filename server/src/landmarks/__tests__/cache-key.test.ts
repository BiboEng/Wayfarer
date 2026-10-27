import { describe, expect, it } from 'vitest';
import {
  buildByIdCacheKey,
  buildNearbyCacheKey,
  CACHE_KEY_VERSION,
  CACHE_SLACK_M,
  radiusBucket,
} from '../cache-key';

describe('radiusBucket', () => {
  it.each([
    [1, 250],
    [50, 250],
    [250, 250],
    [251, 500],
    [500, 500],
    [501, 1000],
    [1000, 1000],
    [1500, 2000],
    [2000, 2000],
    [2001, 5000],
    [9999, 10000],
    [10000, 10000],
    [50000, 10000],
  ])('%d m -> %d m', (radius, bucket) => {
    expect(radiusBucket(radius)).toBe(bucket);
  });
});

describe('buildNearbyCacheKey', () => {
  it('rounds the center to 3 decimals', () => {
    const { center } = buildNearbyCacheKey({ lat: 41.00864, lng: 28.98026 }, 400);
    expect(center).toEqual({ lat: 41.009, lng: 28.98 });
  });

  it('adds the slack to the bucketed radius', () => {
    expect(buildNearbyCacheKey({ lat: 1, lng: 1 }, 400).fetchRadiusMeters).toBe(500 + CACHE_SLACK_M);
  });

  it('gives the same key for nearby points and similar radii', () => {
    const a = buildNearbyCacheKey({ lat: 41.0086, lng: 28.9802 }, 400);
    const b = buildNearbyCacheKey({ lat: 41.0089, lng: 28.9798 }, 480);
    expect(a.key).toBe(b.key);
  });

  it('gives different keys for different cells or buckets', () => {
    const base = buildNearbyCacheKey({ lat: 41.0086, lng: 28.9802 }, 400).key;
    expect(buildNearbyCacheKey({ lat: 41.0106, lng: 28.9802 }, 400).key).not.toBe(base);
    expect(buildNearbyCacheKey({ lat: 41.0086, lng: 28.9802 }, 600).key).not.toBe(base);
  });

  it('contains the version and fixed 3-decimal coordinates', () => {
    const { key } = buildNearbyCacheKey({ lat: 41, lng: 28.5 }, 250);
    expect(key).toBe(`landmarks:${CACHE_KEY_VERSION}:nearby:41.000:28.500:250`);
  });

  it('never produces negative zero', () => {
    const { key, center } = buildNearbyCacheKey({ lat: -0.0002, lng: -0.0004 }, 250);
    expect(Object.is(center.lat, -0)).toBe(false);
    expect(Object.is(center.lng, -0)).toBe(false);
    expect(key).not.toContain('-0.000');
  });

  it('keeps the rounded center within the slack of the original', () => {
    // Worst case: ~0.0005 deg in each axis at 60 degrees latitude is well under the slack.
    const original = { lat: 60.0004999, lng: 10.0004999 };
    const { center } = buildNearbyCacheKey(original, 250);
    const dLat = (Math.abs(center.lat - original.lat) * 111_195);
    const dLng = (Math.abs(center.lng - original.lng) * 111_195 * Math.cos((60 * Math.PI) / 180));
    expect(Math.hypot(dLat, dLng)).toBeLessThan(CACHE_SLACK_M);
  });
});

describe('buildByIdCacheKey', () => {
  it('includes the version and the id', () => {
    expect(buildByIdCacheKey('wiki:12')).toBe(`landmarks:${CACHE_KEY_VERSION}:id:wiki:12`);
  });

  it('differs from nearby keys', () => {
    expect(buildByIdCacheKey('x')).not.toContain(':nearby:');
  });
});
