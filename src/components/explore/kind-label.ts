import type { LandmarkKind } from '@shared/landmarks/landmark';

const LABELS: Record<LandmarkKind, string> = {
  monument: 'Monument',
  building: 'Historic building',
  place_of_worship: 'Place of worship',
  historic_district: 'Historic district',
  bridge: 'Bridge',
  square: 'Square',
  museum: 'Museum',
  castle: 'Castle',
  archaeological_site: 'Archaeological site',
  other: 'Landmark',
};

/** Human-readable name of a landmark kind, e.g. "Place of worship". */
export function kindLabel(kind: LandmarkKind): string {
  return LABELS[kind];
}
