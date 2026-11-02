import { distanceMeters } from '@shared/geo/distance';

import type { LocationFix } from '@/location/types';

import { offsetM, ORIGIN } from '../__fixtures__/places';
import {
  currentHeading,
  DRIVING_ABOVE_MPS,
  DRIVING_AFTER_MS,
  HEADING_STALE_MS,
  INITIAL_MOTION,
  resolveMode,
  updateMotion,
  WALKING_AFTER_MS,
  WALKING_BELOW_MPS,
  type MotionState,
} from '../motion';

const T0 = 1_000_000;
const kmh = (v: number) => v / 3.6;

function fix(over: Partial<LocationFix> & { north?: number; east?: number } = {}): LocationFix {
  const { north = 0, east = 0, ...rest } = over;
  const { lat, lng } = offsetM(ORIGIN, north, east);
  return { lat, lng, accuracyM: 5, speedMps: null, headingDeg: null, timestamp: T0, ...rest };
}

/** Feeds a fix every second for `seconds`, all with the same GPS speed, standing still on the map. */
function feedSpeed(state: MotionState, speedMps: number | null, seconds: number, from = 0): MotionState {
  let s = state;
  for (let i = 0; i < seconds; i++) s = updateMotion(s, fix({ speedMps, timestamp: T0 + (from + i) * 1000 }));
  return s;
}

describe('speed', () => {
  it('is null before any usable sample', () => {
    expect(updateMotion(INITIAL_MOTION, fix()).speedMps).toBeNull();
  });

  it('takes the first GPS speed as is', () => {
    expect(updateMotion(INITIAL_MOTION, fix({ speedMps: 4 })).speedMps).toBe(4);
  });

  it('smooths later samples (35% weight on the newest)', () => {
    const a = updateMotion(INITIAL_MOTION, fix({ speedMps: 10 }));
    const b = updateMotion(a, fix({ speedMps: 0, timestamp: T0 + 1000 }));
    expect(b.speedMps).toBeCloseTo(6.5, 9);
  });

  it('a GPS speed of 0 is a real sample (standing still), not "unknown"', () => {
    const a = updateMotion(INITIAL_MOTION, fix({ speedMps: 3 }));
    expect(updateMotion(a, fix({ speedMps: 0, timestamp: T0 + 1000 })).speedMps).toBeLessThan(3);
  });

  it('falls back to distance over time when GPS speed is null', () => {
    const a = updateMotion(INITIAL_MOTION, fix());
    const b = updateMotion(a, fix({ north: 14, timestamp: T0 + 10_000 }));
    if (!a.last || !b.last) throw new Error('motion keeps the last fix');
    expect(b.speedMps).toBeCloseTo(distanceMeters(a.last, b.last) / 10, 6);
    expect(b.speedMps).toBeCloseTo(1.4, 1);
  });

  it('keeps the previous speed when no sample can be made (same timestamp, no GPS speed)', () => {
    const a = updateMotion(INITIAL_MOTION, fix({ speedMps: 5 }));
    const b = updateMotion(a, fix({ north: 5 }));
    expect(b.speedMps).toBe(5);
  });

  it('ignores an implausible jump (GPS glitch)', () => {
    const a = updateMotion(INITIAL_MOTION, fix({ speedMps: 5 }));
    expect(updateMotion(a, fix({ speedMps: 300, timestamp: T0 + 1000 })).speedMps).toBe(5);
    const c = updateMotion(a, fix({ north: 50_000, timestamp: T0 + 1000 }));
    expect(c.speedMps).toBe(5);
  });
});

describe('course (heading)', () => {
  it('is unknown on the first fix', () => {
    const s = updateMotion(INITIAL_MOTION, fix());
    expect(s.headingDeg).toBeNull();
    expect(currentHeading(s, T0)).toBeNull();
  });

  it('stays unknown for moves shorter than 15 m', () => {
    let s = updateMotion(INITIAL_MOTION, fix());
    s = updateMotion(s, fix({ north: 14, timestamp: T0 + 5000 }));
    expect(s.headingDeg).toBeNull();
  });

  it('becomes known after a move of 15 m or more', () => {
    let s = updateMotion(INITIAL_MOTION, fix());
    s = updateMotion(s, fix({ north: 16, timestamp: T0 + 5000 }));
    expect(s.headingDeg).toBeCloseTo(0, 1);
  });

  it('measures from the anchor, so small steps add up to a heading', () => {
    let s = updateMotion(INITIAL_MOTION, fix());
    s = updateMotion(s, fix({ north: 8, timestamp: T0 + 3000 }));
    expect(s.headingDeg).toBeNull();
    s = updateMotion(s, fix({ north: 16, timestamp: T0 + 6000 }));
    expect(s.headingDeg).toBeCloseTo(0, 1);
  });

  it('points east after a 20 m move east, and re-anchors for the next one', () => {
    let s = updateMotion(INITIAL_MOTION, fix());
    s = updateMotion(s, fix({ east: 20, timestamp: T0 + 5000 }));
    expect(s.headingDeg).toBeCloseTo(90, 0);
    s = updateMotion(s, fix({ east: 20, north: 20, timestamp: T0 + 10_000 }));
    expect(s.headingDeg).toBeCloseTo(0, 0);
  });

  it('ignores the heading the source reports', () => {
    const s = updateMotion(INITIAL_MOTION, fix({ headingDeg: 123 }));
    expect(s.headingDeg).toBeNull();
  });

  it('a poor accuracy raises the needed move (30 m accuracy -> 30 m)', () => {
    let s = updateMotion(INITIAL_MOTION, fix({ accuracyM: 30 }));
    s = updateMotion(s, fix({ north: 20, accuracyM: 30, timestamp: T0 + 5000 }));
    expect(s.headingDeg).toBeNull();
    s = updateMotion(s, fix({ north: 31, accuracyM: 30, timestamp: T0 + 10_000 }));
    expect(s.headingDeg).toBeCloseTo(0, 1);
  });

  it('an unknown accuracy (Infinity) does not block headings for ever', () => {
    let s = updateMotion(INITIAL_MOTION, fix({ accuracyM: Infinity }));
    s = updateMotion(s, fix({ north: 60, accuracyM: Infinity, timestamp: T0 + 5000 }));
    expect(s.headingDeg).toBeCloseTo(0, 1);
  });

  it('is trusted for 2 minutes, then dropped', () => {
    let s = updateMotion(INITIAL_MOTION, fix());
    s = updateMotion(s, fix({ north: 20, timestamp: T0 + 5000 }));
    const measuredAt = T0 + 5000;
    expect(currentHeading(s, measuredAt + HEADING_STALE_MS)).toBeCloseTo(0, 1);
    expect(currentHeading(s, measuredAt + HEADING_STALE_MS + 1)).toBeNull();
  });
});

describe('mode detection (hysteresis)', () => {
  it('starts as walking', () => expect(INITIAL_MOTION.detectedMode).toBe('walking'));

  it('switches to driving only after 15 s continuously above 12 km/h', () => {
    const fast = kmh(20);
    let s = feedSpeed(INITIAL_MOTION, fast, 15); // t = 0..14 s: the clock starts at t = 0
    expect(s.detectedMode).toBe('walking');
    s = updateMotion(s, fix({ speedMps: fast, timestamp: T0 + DRIVING_AFTER_MS }));
    expect(s.detectedMode).toBe('driving');
  });

  it('does not switch to driving on a short burst of speed', () => {
    let s = feedSpeed(INITIAL_MOTION, kmh(25), 10);
    s = feedSpeed(s, 0, 10, 10); // stops: smoothed speed falls below 12 km/h, the clock resets
    expect(s.detectedMode).toBe('walking');
    s = feedSpeed(s, kmh(25), 10, 20);
    expect(s.detectedMode).toBe('walking'); // 10 s + 10 s is not 15 s in a row
  });

  it('exactly 12 km/h is not above the threshold', () => {
    const s = feedSpeed(INITIAL_MOTION, DRIVING_ABOVE_MPS, 120);
    expect(s.detectedMode).toBe('walking');
  });

  function drivingState(): MotionState {
    return feedSpeed(INITIAL_MOTION, kmh(40), 30); // well past 15 s
  }

  it('is driving after sustained speed', () => expect(drivingState().detectedMode).toBe('driving'));

  it('switches back to walking only after 30 s continuously below 7 km/h', () => {
    let s = drivingState();
    const slow = kmh(2);
    let belowSince: number | null = null;
    let walkingAt: number | null = null;
    for (let i = 0; i < 120 && walkingAt === null; i++) {
      const t = T0 + (100 + i) * 1000;
      s = updateMotion(s, fix({ speedMps: slow, timestamp: t }));
      if (belowSince === null && s.speedMps !== null && s.speedMps < WALKING_BELOW_MPS) belowSince = t;
      if (s.detectedMode === 'walking') walkingAt = t;
    }
    expect(belowSince).not.toBeNull();
    expect(walkingAt).not.toBeNull();
    expect((walkingAt ?? 0) - (belowSince ?? 0)).toBe(WALKING_AFTER_MS);
  });

  it('a red light (short stop) while driving does not switch to walking', () => {
    let s = drivingState();
    s = feedSpeed(s, 0, 20, 100); // 20 s stopped
    expect(s.detectedMode).toBe('driving');
    s = feedSpeed(s, kmh(40), 30, 120);
    expect(s.detectedMode).toBe('driving');
  });

  it('does not flap around 10 km/h, in either mode', () => {
    // Between 7 and 12 km/h: walkers stay walkers and drivers stay drivers.
    const wobble = (state: MotionState) => {
      let s = state;
      const seen = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const speed = kmh(i % 2 === 0 ? 9 : 11);
        s = updateMotion(s, fix({ speedMps: speed, timestamp: T0 + (200 + i) * 1000 }));
        seen.add(s.detectedMode);
      }
      return seen;
    };
    expect([...wobble(INITIAL_MOTION)]).toEqual(['walking']);
    expect([...wobble(drivingState())]).toEqual(['driving']);
  });

  it('keeps the mode when no speed sample is available', () => {
    const s = updateMotion(INITIAL_MOTION, fix());
    expect(s.detectedMode).toBe('walking');
    expect(s.switchSince).toBeNull();
  });

  it('detects driving from positions alone when GPS gives no speed', () => {
    let s = INITIAL_MOTION;
    for (let i = 0; i <= 30; i++) s = updateMotion(s, fix({ north: i * 10 * 5, timestamp: T0 + i * 5000 })); // 10 m/s
    expect(s.detectedMode).toBe('driving');
  });
});

describe('resolveMode', () => {
  it('the Settings choice wins over the detected mode', () => {
    expect(resolveMode('walking', 'driving')).toBe('driving');
    expect(resolveMode('driving', 'walking')).toBe('walking');
  });
  it("'auto' uses the detected mode", () => {
    expect(resolveMode('walking', 'auto')).toBe('walking');
    expect(resolveMode('driving', 'auto')).toBe('driving');
  });
});
