import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';
import type { NearestLandmarkResponse } from '@shared/api/landmarks';
import type { Landmark } from '@shared/landmarks/landmark';
import type { LandmarkProvider } from '@shared/landmarks/provider';
import { NEAREST_BUDGET_MS, withTimeout } from './budget';
import { LandmarkUpstreamError } from './landmark-upstream-error';
import { EXPLORE_RADIUS_STEPS_M } from '@shared/landmarks/search';

function closestWithWikipedia(landmarks: Landmark[], center: LatLng): Landmark | null {
  let best: Landmark | null = null;
  let bestDistance = Infinity;
  for (const landmark of landmarks) {
    if (!landmark.wikipedia) continue;
    const distance = distanceMeters(center, landmark.location);
    if (distance < bestDistance) {
      best = landmark;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Explore mode: widens the radius step by step and stops at the first step that
 * has a Wikipedia-backed landmark. OSM-only hits do not count. Nothing within
 * the widest step is a valid answer (landmark: null).
 */
export async function findNearestLandmark(
  provider: LandmarkProvider,
  center: LatLng,
  signal?: AbortSignal,
  steps: readonly number[] = EXPLORE_RADIUS_STEPS_M,
): Promise<NearestLandmarkResponse> {
  // Steps above the Overpass maximum are Wikipedia-only; the whole search shares one budget.
  const searchSignal = withTimeout(NEAREST_BUDGET_MS, signal);
  let searched = 0;
  for (const radiusMeters of steps) {
    searched = radiusMeters;
    let landmarks: Landmark[];
    try {
      landmarks = await provider.findNearby({ center, radiusMeters }, searchSignal);
    } catch (error) {
      if (searchSignal.aborted && !signal?.aborted) throw new LandmarkUpstreamError('landmarks', 'search timed out');
      throw error;
    }
    const found = closestWithWikipedia(landmarks, center);
    if (found) return { landmark: found, searchedRadiusMeters: radiusMeters };
  }
  return { landmark: null, searchedRadiusMeters: searched };
}
