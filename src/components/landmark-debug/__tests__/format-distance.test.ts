import { formatDistance } from '../format-distance';

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [0.4, '0 m'],
    [85, '85 m'],
    [85.6, '86 m'],
    [999, '999 m'],
    [1000, '1.0 km'],
    [1250, '1.3 km'],
    [9949, '9.9 km'],
    [12_400, '12 km'],
    [10_000, '10 km'],
  ])('%d m -> %s', (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });

  it('rounds up into the next unit: 999.6 m is 1.0 km, not 1000 m', () => {
    expect(formatDistance(999.6)).toBe('1.0 km');
    expect(formatDistance(999.4)).toBe('999 m');
    expect(formatDistance(999.5)).toBe('1.0 km');
  });

  it('rounds up into whole km: 9.96 km is 10 km, not 10.0 km', () => {
    expect(formatDistance(9960)).toBe('10 km');
    expect(formatDistance(9949)).toBe('9.9 km');
    expect(formatDistance(9950)).toBe('10 km');
  });

  it('never prints a trailing .0 above 10 km', () => {
    expect(formatDistance(10_040)).toBe('10 km');
    expect(formatDistance(99_600)).toBe('100 km');
  });
});
