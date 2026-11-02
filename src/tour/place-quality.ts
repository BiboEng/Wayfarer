/**
 * Spots search results that are probably not places: Wikipedia geotags events too
 * (e.g. "740 Constantinople earthquake"). Pure: no React or Expo imports.
 */
import type { Landmark } from '@shared/landmarks/landmark';

/** A title that starts with a year ("740 Constantinople earthquake"). */
const LEADING_YEAR = /^\d{3,4}\s/;
/** Words that name an event rather than a place. */
const EVENT_WORDS =
  /\b(earthquakes?|battle|siege|fire|massacre|riots?|uprising|revolt|rebellion|bombings?|attacks?|explosion|accident|disaster|flood|plague|treaty|sack of|fall of|conquest|incident|shooting|protests?)\b/i;

/** No OpenStreetMap match and no known kind: could be anything Wikipedia geotagged. */
export function lacksPlaceData(landmark: Landmark): boolean {
  return landmark.kind === 'other' && (!landmark.osmTags || Object.keys(landmark.osmTags).length === 0);
}

/** The title reads like an event. Only used when there is no OSM data to say otherwise. */
export function looksLikeEvent(landmark: Landmark): boolean {
  const titles = [landmark.name, landmark.wikipedia?.title ?? ''];
  return titles.some((title) => LEADING_YEAR.test(title) || EVENT_WORDS.test(title));
}

/** 0 = a real place, 1 = unknown kind, 2 = probably an event. */
export function nonPlaceLevel(landmark: Landmark): 0 | 1 | 2 {
  if (!lacksPlaceData(landmark)) return 0;
  return looksLikeEvent(landmark) ? 2 : 1;
}
