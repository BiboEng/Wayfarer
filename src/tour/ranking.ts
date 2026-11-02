/**
 * Picks the best landmark to narrate next. Pure: no React or Expo imports.
 *
 * Must have: a Wikipedia article, inside the radius, not excluded (visited, current, failed);
 * when driving, not behind. Lower cost is better: distance (0..1 of the radius), minus an
 * ahead bonus, plus penalties for probable non-places and (walking) places behind.
 */
import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';

import { sideOfPlace, type RelativeSide } from './bearing';
import type { ModeProfile } from './mode-profile';
import { nonPlaceLevel } from './place-quality';

export const AHEAD_BONUS = 0.25;
export const BEHIND_PENALTY = 0.2;
/** Per non-place level: an unknown kind is pushed down a little, a probable event a lot. */
export const NON_PLACE_PENALTY = [0, 0.4, 1.5] as const;

export interface RankContext {
  position: LatLng;
  /** null when the direction of travel is unknown (no ahead bonus, nothing dropped as behind). */
  headingDeg: number | null;
  profile: ModeProfile;
  /** Ids that must not be picked. */
  excluded: ReadonlySet<string>;
}

export interface RankedCandidate {
  landmark: Landmark;
  distanceM: number;
  /** null when the heading is unknown. */
  side: RelativeSide | null;
  cost: number;
}

/** Qualifying landmarks, best first. Empty means "stay silent". */
export function rankCandidates(landmarks: readonly Landmark[], context: RankContext): RankedCandidate[] {
  const { position, headingDeg, profile, excluded } = context;
  const ranked: RankedCandidate[] = [];
  for (const landmark of landmarks) {
    if (!landmark.wikipedia || excluded.has(landmark.id)) continue;
    const distanceM = distanceMeters(position, landmark.location);
    if (distanceM > profile.radiusM) continue;
    const side = headingDeg === null ? null : sideOfPlace(position, headingDeg, landmark.location);
    if (profile.aheadOnly && side === 'behind') continue;
    ranked.push({ landmark, distanceM, side, cost: costOf(landmark, distanceM, side, profile) });
  }
  return ranked.sort((a, b) => a.cost - b.cost || a.landmark.id.localeCompare(b.landmark.id));
}

/** The best candidate, or null when nothing qualifies. */
export function bestCandidate(landmarks: readonly Landmark[], context: RankContext): RankedCandidate | null {
  return rankCandidates(landmarks, context)[0] ?? null;
}

function costOf(landmark: Landmark, distanceM: number, side: RelativeSide | null, profile: ModeProfile): number {
  let cost = distanceM / profile.radiusM;
  if (side === 'ahead') cost -= AHEAD_BONUS;
  else if (side === 'behind') cost += BEHIND_PENALTY;
  return cost + NON_PLACE_PENALTY[nonPlaceLevel(landmark)];
}
