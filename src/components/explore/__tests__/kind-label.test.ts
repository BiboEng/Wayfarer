import type { LandmarkKind } from '@shared/landmarks/landmark';

import { kindLabel } from '../kind-label';

// Keep in sync with LandmarkKind: the Record type in kind-label.ts fails to compile if one is missing,
// and this list fails the test if a kind is added here but has no label.
const ALL_KINDS: LandmarkKind[] = [
  'monument',
  'building',
  'place_of_worship',
  'historic_district',
  'bridge',
  'square',
  'museum',
  'castle',
  'archaeological_site',
  'other',
];

describe('kindLabel', () => {
  it.each(ALL_KINDS)('has a human-readable label for %s', (kind) => {
    const label = kindLabel(kind);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toContain('_');
    expect(label[0]).toBe(label[0].toUpperCase());
  });

  it('gives each kind its own label', () => {
    expect(new Set(ALL_KINDS.map(kindLabel)).size).toBe(ALL_KINDS.length);
  });
});
