/**
 * Speed, direction of travel and walking/driving detection from location fixes.
 * Pure: no React or Expo imports. Feed every fix to `updateMotion`.
 */
import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';
import type { TravelMode } from '@shared/narration/options';

import type { LocationFix } from '@/location/types';

import { bearingDeg } from './bearing';

/** Course comes only from moves at least this long (or the fix accuracy, if worse, up to the cap). */
export const COURSE_MIN_MOVE_M = 15;
const COURSE_MAX_MOVE_M = 50;
/** No 15 m move for this long: the heading is no longer trusted. */
export const HEADING_STALE_MS = 120_000;
/** Weight of the newest speed sample in the moving average. */
const SPEED_SMOOTHING = 0.35;
/** Faster than this is a GPS glitch, not travel. */
const MAX_PLAUSIBLE_MPS = 70;

/** Switch to driving after DRIVING_AFTER_MS continuously above DRIVING_ABOVE_MPS (12 km/h). */
export const DRIVING_ABOVE_MPS = 12 / 3.6;
export const DRIVING_AFTER_MS = 15_000;
/** Switch back to walking after WALKING_AFTER_MS continuously below WALKING_BELOW_MPS (7 km/h). */
export const WALKING_BELOW_MPS = 7 / 3.6;
export const WALKING_AFTER_MS = 30_000;

export interface MotionState {
  last: LocationFix | null;
  /** Smoothed speed in m/s; null until the first sample. */
  speedMps: number | null;
  /** Where the current course was measured from. */
  courseFrom: { point: LatLng; timestamp: number } | null;
  headingDeg: number | null;
  /** When `headingDeg` was last measured (epoch ms). */
  headingAt: number | null;
  /** Mode detected from speed (before any Settings override). */
  detectedMode: TravelMode;
  /** Since when the speed has been past the threshold for switching modes; null when it isn't. */
  switchSince: number | null;
}

export const INITIAL_MOTION: MotionState = {
  last: null,
  speedMps: null,
  courseFrom: null,
  headingDeg: null,
  headingAt: null,
  detectedMode: 'walking',
  switchSince: null,
};

export function updateMotion(state: MotionState, fix: LocationFix): MotionState {
  const point = { lat: fix.lat, lng: fix.lng };
  const speedMps = smoothSpeed(state.speedMps, rawSpeed(state.last, fix));
  const course = updateCourse(state, fix, point);
  const { detectedMode, switchSince } = detectMode(state, speedMps, fix.timestamp);
  return { ...state, ...course, last: fix, speedMps, detectedMode, switchSince };
}

/** The Settings choice wins; 'auto' uses the detected mode. */
export function resolveMode(detected: TravelMode, override: 'auto' | TravelMode): TravelMode {
  return override === 'auto' ? detected : override;
}

/** The direction of travel, or null when unknown or too old to trust. */
export function currentHeading(state: MotionState, now: number): number | null {
  if (state.headingDeg === null || state.headingAt === null) return null;
  return now - state.headingAt <= HEADING_STALE_MS ? state.headingDeg : null;
}

/** GPS speed when reported, otherwise distance over time since the last fix. */
function rawSpeed(last: LocationFix | null, fix: LocationFix): number | null {
  if (fix.speedMps !== null && fix.speedMps >= 0) return fix.speedMps <= MAX_PLAUSIBLE_MPS ? fix.speedMps : null;
  if (!last) return null;
  const seconds = (fix.timestamp - last.timestamp) / 1000;
  if (seconds <= 0) return null;
  const speed = distanceMeters(last, fix) / seconds;
  return speed <= MAX_PLAUSIBLE_MPS ? speed : null;
}

function smoothSpeed(previous: number | null, sample: number | null): number | null {
  if (sample === null) return previous;
  if (previous === null) return sample;
  return previous + SPEED_SMOOTHING * (sample - previous);
}

function updateCourse(
  state: MotionState,
  fix: LocationFix,
  point: LatLng,
): Pick<MotionState, 'courseFrom' | 'headingDeg' | 'headingAt'> {
  const { courseFrom } = state;
  if (!courseFrom) return { courseFrom: { point, timestamp: fix.timestamp }, headingDeg: state.headingDeg, headingAt: state.headingAt };
  const minMove = Math.max(COURSE_MIN_MOVE_M, Math.min(fix.accuracyM, COURSE_MAX_MOVE_M));
  if (distanceMeters(courseFrom.point, point) < minMove) {
    return { courseFrom, headingDeg: state.headingDeg, headingAt: state.headingAt };
  }
  return {
    courseFrom: { point, timestamp: fix.timestamp },
    headingDeg: bearingDeg(courseFrom.point, point),
    headingAt: fix.timestamp,
  };
}

/** Hysteresis: the speed must stay past the threshold for a while before the mode flips. */
function detectMode(
  state: MotionState,
  speedMps: number | null,
  timestamp: number,
): Pick<MotionState, 'detectedMode' | 'switchSince'> {
  const { detectedMode } = state;
  if (speedMps === null) return { detectedMode, switchSince: state.switchSince };
  const walking = detectedMode === 'walking';
  const pastThreshold = walking ? speedMps > DRIVING_ABOVE_MPS : speedMps < WALKING_BELOW_MPS;
  if (!pastThreshold) return { detectedMode, switchSince: null };

  const since = state.switchSince ?? timestamp;
  const needed = walking ? DRIVING_AFTER_MS : WALKING_AFTER_MS;
  if (timestamp - since >= needed) return { detectedMode: walking ? 'driving' : 'walking', switchSince: null };
  return { detectedMode, switchSince: since };
}
