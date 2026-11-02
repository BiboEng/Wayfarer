/** Search radius, re-check distance and narration style per travel mode. Pure: no React or Expo imports. */
import type { TravelMode } from '@shared/narration/options';

export interface ModeProfile {
  mode: TravelMode;
  /** Landmark search radius around the traveller. */
  radiusM: number;
  /** Search again after moving this far from the last check point. */
  recheckEveryM: number;
  /** Sent as the narration's travelMode (driving stories are shorter). */
  travelMode: TravelMode;
  /** Only landmarks ahead or to the side count (never behind). */
  aheadOnly: boolean;
  /** Fixes less accurate than this are ignored for motion, heading, re-checks and ranking. */
  maxAccuracyM: number;
  /**
   * With a known heading, the search is centred this far ahead (the server returns at most the
   * 20 nearest Wikipedia pages, so centring ahead spends them on places still to come).
   */
  searchAheadM: number;
}

export const MODE_PROFILES: Record<TravelMode, ModeProfile> = {
  walking: {
    mode: 'walking',
    radiusM: 200,
    recheckEveryM: 60,
    travelMode: 'walking',
    aheadOnly: false,
    maxAccuracyM: 100,
    searchAheadM: 0,
  },
  driving: {
    mode: 'driving',
    radiusM: 800,
    recheckEveryM: 250,
    travelMode: 'driving',
    aheadOnly: true,
    maxAccuracyM: 150,
    searchAheadM: 400,
  },
};

export function profileFor(mode: TravelMode): ModeProfile {
  return MODE_PROFILES[mode];
}

/** A fix accurate enough to steer the tour (rougher ones only move the map dot). */
export function isUsableFix(accuracyM: number, profile: ModeProfile): boolean {
  return accuracyM <= profile.maxAccuracyM;
}
