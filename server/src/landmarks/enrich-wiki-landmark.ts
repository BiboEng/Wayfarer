import type { Landmark } from '@shared/landmarks/landmark';
import type { OverpassClient } from './overpass-client';
import { parseOverpass } from './parse-overpass';

/**
 * Fills kind and osmTags of a Wikipedia-only landmark from the OSM element with the
 * same Wikidata id. Any failure keeps the landmark as it is (kind 'other').
 */
export async function enrichFromOsm(landmark: Landmark, overpass: OverpassClient, signal: AbortSignal): Promise<Landmark> {
  if (!landmark.wikidataId) return landmark;
  try {
    const osm = parseOverpass(await overpass.byWikidata(landmark.wikidataId, signal))[0];
    if (!osm) return landmark;
    return {
      ...landmark,
      kind: osm.kind !== 'other' ? osm.kind : landmark.kind,
      ...(osm.osmTags ? { osmTags: { ...osm.osmTags, ...landmark.osmTags } } : {}),
    };
  } catch {
    return landmark;
  }
}
