import { isUsableFix, MODE_PROFILES, profileFor } from '../mode-profile';
import { offsetM, ORIGIN } from '../__fixtures__/places';
import { isRetryDue, RETRY_AFTER_MS, shouldRecheck } from '../recheck';

describe('mode profiles', () => {
  it('walking: 200 m radius, re-check every 60 m, anything around', () => {
    expect(profileFor('walking')).toMatchObject({ radiusM: 200, recheckEveryM: 60, travelMode: 'walking', aheadOnly: false });
  });
  it('driving: 800 m radius, re-check every 250 m, only places ahead', () => {
    expect(profileFor('driving')).toMatchObject({ radiusM: 800, recheckEveryM: 250, travelMode: 'driving', aheadOnly: true });
  });
  it('only driving centres the search ahead (400 m)', () => {
    expect(profileFor('walking').searchAheadM).toBe(0);
    expect(profileFor('driving').searchAheadM).toBe(400);
  });
  it('each profile names its own mode', () => {
    expect(MODE_PROFILES.walking.mode).toBe('walking');
    expect(MODE_PROFILES.driving.mode).toBe('driving');
  });
});

describe('shouldRecheck', () => {
  it('is true on the first fix (no check point yet)', () => {
    expect(shouldRecheck(null, ORIGIN, 60)).toBe(true);
  });
  it('is false before the walking distance (60 m)', () => {
    expect(shouldRecheck(ORIGIN, offsetM(ORIGIN, 55), 60)).toBe(false);
    expect(shouldRecheck(ORIGIN, ORIGIN, 60)).toBe(false);
  });
  it('is true after the walking distance', () => {
    expect(shouldRecheck(ORIGIN, offsetM(ORIGIN, 61), 60)).toBe(true);
    expect(shouldRecheck(ORIGIN, offsetM(ORIGIN, 0, -120), 60)).toBe(true);
  });
  it('is false before the driving distance (250 m) and true after it', () => {
    expect(shouldRecheck(ORIGIN, offsetM(ORIGIN, 240), 250)).toBe(false);
    expect(shouldRecheck(ORIGIN, offsetM(ORIGIN, 260), 250)).toBe(true);
  });
  it('the walking distance does not trigger a driving re-check', () => {
    const moved = offsetM(ORIGIN, 100);
    expect(shouldRecheck(ORIGIN, moved, MODE_PROFILES.walking.recheckEveryM)).toBe(true);
    expect(shouldRecheck(ORIGIN, moved, MODE_PROFILES.driving.recheckEveryM)).toBe(false);
  });
});

describe('accuracy gate', () => {
  it('walking ignores fixes worse than 100 m', () => {
    expect(isUsableFix(100, MODE_PROFILES.walking)).toBe(true);
    expect(isUsableFix(100.5, MODE_PROFILES.walking)).toBe(false);
    expect(isUsableFix(Infinity, MODE_PROFILES.walking)).toBe(false);
  });
  it('driving ignores fixes worse than 150 m', () => {
    expect(isUsableFix(150, MODE_PROFILES.driving)).toBe(true);
    expect(isUsableFix(151, MODE_PROFILES.driving)).toBe(false);
    expect(isUsableFix(120, MODE_PROFILES.walking)).toBe(false);
    expect(isUsableFix(120, MODE_PROFILES.driving)).toBe(true);
  });
});

describe('isRetryDue', () => {
  it('is false when nothing failed', () => expect(isRetryDue(null, 1e12)).toBe(false));
  it('is true once the time has come', () => {
    expect(isRetryDue(1000, 999)).toBe(false);
    expect(isRetryDue(1000, 1000)).toBe(true);
    expect(isRetryDue(1000, 5000)).toBe(true);
  });
  it('retries after about a minute', () => expect(RETRY_AFTER_MS).toBe(60_000));
});
