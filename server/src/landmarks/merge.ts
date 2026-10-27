import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';

/** Same-name features closer than this are the same place. */
export const SAME_PLACE_DISTANCE_M = 75;

/**
 * Lowercase, letters and digits only, single spaces. Accents are removed from
 * Latin letters only; marks in other scripts (Cyrillic, Devanagari, Arabic) are part of the letter.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

/** OSM `wikipedia=en:Title` to a normalized title; other languages return undefined. */
function englishWikipediaTitle(tag: string | undefined): string | undefined {
  if (!tag || !tag.startsWith('en:')) return undefined;
  return normalizeName(tag.slice(3).replace(/_/g, ' '));
}

function sameWikidata(wiki: Landmark, osm: Landmark): boolean {
  return wiki.wikidataId !== undefined && wiki.wikidataId === osm.wikidataId;
}

function sameWikipediaTitle(wiki: Landmark, osm: Landmark): boolean {
  const title = englishWikipediaTitle(osm.osmTags?.wikipedia);
  return title !== undefined && wiki.wikipedia !== undefined && title === normalizeName(wiki.wikipedia.title);
}

function sameNameAndPlace(a: Landmark, b: Landmark): boolean {
  return (
    normalizeName(a.name) === normalizeName(b.name) &&
    normalizeName(a.name) !== '' &&
    distanceMeters(a.location, b.location) <= SAME_PLACE_DISTANCE_M
  );
}

/** Rules in priority order (strongest evidence first). */
const MATCH_RULES: ReadonlyArray<(wiki: Landmark, osm: Landmark) => boolean> = [
  sameWikidata,
  sameWikipediaTitle,
  sameNameAndPlace,
];

function findWikiMatch(osm: Landmark, wiki: Landmark[]): number {
  for (const rule of MATCH_RULES) {
    let best = -1;
    let bestDistance = Infinity;
    wiki.forEach((candidate, index) => {
      if (!rule(candidate, osm)) return;
      const distance = distanceMeters(candidate.location, osm.location);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0) return best;
  }
  return -1;
}

/** Wikipedia id, text and location stay; OSM adds the kind and tags. */
function mergePair(wiki: Landmark, osm: Landmark): Landmark {
  const wikidataId = wiki.wikidataId ?? osm.wikidataId;
  return {
    ...wiki,
    kind: osm.kind !== 'other' ? osm.kind : wiki.kind,
    ...(wikidataId ? { wikidataId } : {}),
    ...(osm.osmTags ? { osmTags: { ...osm.osmTags, ...wiki.osmTags } } : {}),
  };
}

function isDuplicateOsm(candidate: Landmark, kept: Landmark): boolean {
  return (
    (candidate.wikidataId !== undefined && candidate.wikidataId === kept.wikidataId) ||
    sameNameAndPlace(candidate, kept)
  );
}

/**
 * Pure: combines Wikipedia and OSM landmarks, removing duplicates, nearest to
 * `center` first. A merged landmark keeps its `wiki:<pageId>` id.
 */
export function mergeLandmarks(wikipedia: Landmark[], osm: Landmark[], center: LatLng): Landmark[] {
  const merged = [...wikipedia];
  const osmOnly: Landmark[] = [];
  for (const candidate of osm) {
    const index = findWikiMatch(candidate, merged);
    if (index >= 0) {
      merged[index] = mergePair(merged[index], candidate);
    } else if (!osmOnly.some((kept) => isDuplicateOsm(candidate, kept))) {
      osmOnly.push(candidate);
    }
  }
  return sortNearestFirst([...merged, ...osmOnly], center);
}

export function sortNearestFirst(landmarks: Landmark[], center: LatLng): Landmark[] {
  return landmarks
    .map((landmark) => ({ landmark, distance: distanceMeters(center, landmark.location) }))
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.landmark);
}
