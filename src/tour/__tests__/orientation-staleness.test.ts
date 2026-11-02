import { MODE_PROFILES } from '../mode-profile';
import { offsetM, ORIGIN } from '../__fixtures__/places';
import { ORIENTATION_MIN_DISTANCE_M, orientationSide } from '../orientation';
import { isStaleStory, STALE_RADIUS_FACTOR } from '../staleness';

describe('orientationSide', () => {
  it('is null without a position', () => {
    expect(orientationSide(null, 0, offsetM(ORIGIN, 100))).toBeNull();
  });

  it('is null with no heading', () => {
    expect(orientationSide(ORIGIN, null, offsetM(ORIGIN, 100))).toBeNull();
  });

  it('is null at 40 m or less', () => {
    expect(ORIENTATION_MIN_DISTANCE_M).toBe(40);
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, 39))).toBeNull();
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, 0))).toBeNull();
  });

  it('is set just beyond 40 m', () => {
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, 42))).toBe('ahead');
  });

  it('is null when the place is behind', () => {
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, -100))).toBeNull();
  });

  it('is ahead, left or right otherwise', () => {
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, 100))).toBe('ahead');
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, 0, -100))).toBe('left');
    expect(orientationSide(ORIGIN, 0, offsetM(ORIGIN, 0, 100))).toBe('right');
  });

  it('uses the heading, not north: heading west, a place to the north is on the right', () => {
    expect(orientationSide(ORIGIN, 270, offsetM(ORIGIN, 100))).toBe('right');
  });
});

describe('isStaleStory', () => {
  const { walking, driving } = MODE_PROFILES;

  it('walking stories never go stale, however far or behind', () => {
    expect(isStaleStory(ORIGIN, 0, offsetM(ORIGIN, -500), walking)).toBe(false);
    expect(isStaleStory(ORIGIN, 0, offsetM(ORIGIN, 5000), walking)).toBe(false);
  });

  it('driving: a place ahead within 1.5x the radius is fine', () => {
    expect(STALE_RADIUS_FACTOR).toBe(1.5);
    expect(isStaleStory(ORIGIN, 0, offsetM(ORIGIN, 1100), driving)).toBe(false);
  });

  it('driving: more than 1.5x the radius (1200 m) away is stale, even when ahead', () => {
    expect(isStaleStory(ORIGIN, 0, offsetM(ORIGIN, 1250), driving)).toBe(true);
  });

  it('driving: a place that is now behind is stale, however near', () => {
    expect(isStaleStory(ORIGIN, 0, offsetM(ORIGIN, -20), driving)).toBe(true);
  });

  it('driving: a place to the side is not stale', () => {
    expect(isStaleStory(ORIGIN, 0, offsetM(ORIGIN, 0, 300), driving)).toBe(false);
  });

  it('driving with an unknown heading is judged on distance only', () => {
    expect(isStaleStory(ORIGIN, null, offsetM(ORIGIN, -100), driving)).toBe(false);
    expect(isStaleStory(ORIGIN, null, offsetM(ORIGIN, -1300), driving)).toBe(true);
  });
});
