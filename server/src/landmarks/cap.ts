import type { Landmark } from '@shared/landmarks/landmark';

/** Most OSM-only landmarks kept per fetch; Wikipedia-backed ones are never dropped. */
export const MAX_OSM_ONLY = 60;

/** Pure: input is nearest first. Keeps every Wikipedia-backed landmark and the nearest `max` others. */
export function capOsmOnly(landmarks: Landmark[], max: number = MAX_OSM_ONLY): Landmark[] {
  let osmOnly = 0;
  return landmarks.filter((landmark) => {
    if (landmark.wikipedia) return true;
    osmOnly += 1;
    return osmOnly <= max;
  });
}
