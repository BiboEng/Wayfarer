import type { NarrationResponse } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';

/** A made-up spot in Istanbul; every test place is placed relative to it. */
export const ORIGIN: LatLng = { lat: 41.01, lng: 28.98 };

const METERS_PER_DEGREE_LAT = 111_320;

/** The point `northM` meters north and `eastM` meters east of `from` (flat-earth, fine for a few km). */
export function offsetM(from: LatLng, northM: number, eastM = 0): LatLng {
  return {
    lat: from.lat + northM / METERS_PER_DEGREE_LAT,
    lng: from.lng + eastM / (METERS_PER_DEGREE_LAT * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/** A real, narratable place: has a Wikipedia article and OSM tags. */
export function place(id: string, location: LatLng, over: Partial<Landmark> = {}): Landmark {
  return {
    id,
    name: `Place ${id}`,
    location,
    kind: 'monument',
    osmTags: { historic: 'monument' },
    wikipedia: {
      pageId: 1,
      title: `Place ${id}`,
      url: `https://en.wikipedia.org/wiki/Place_${id}`,
      extract: `About place ${id}.`,
    },
    ...over,
  };
}

/** The same place without a Wikipedia article (cannot be narrated). */
export function placeWithoutWikipedia(id: string, location: LatLng): Landmark {
  const landmark = place(id, location);
  delete landmark.wikipedia;
  return landmark;
}

export function narrationFor(landmarkId: string, over: Partial<NarrationResponse> = {}): NarrationResponse {
  return {
    landmarkId,
    text: `The story of ${landmarkId}.`,
    audio: { url: `/narrations/audio/${encodeURIComponent(landmarkId)}`, contentType: 'audio/mpeg' },
    source: 'ai',
    ...over,
  };
}
