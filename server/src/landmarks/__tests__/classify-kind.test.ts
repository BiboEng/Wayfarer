import { describe, expect, it } from 'vitest';
import { classifyKind } from '../classify-kind';

describe('classifyKind', () => {
  it.each([
    [{ historic: 'castle' }, 'castle'],
    [{ historic: 'fort' }, 'castle'],
    [{ historic: 'archaeological_site' }, 'archaeological_site'],
    [{ historic: 'monument' }, 'monument'],
    [{ historic: 'memorial' }, 'monument'],
    [{ historic: 'statue' }, 'monument'],
    [{ historic: 'building' }, 'building'],
    [{ historic: 'palace' }, 'building'],
    [{ historic: 'tower' }, 'building'],
    [{ historic: 'district' }, 'historic_district'],
    [{ tourism: 'museum' }, 'museum'],
    [{ tourism: 'artwork' }, 'monument'],
    [{ amenity: 'place_of_worship' }, 'place_of_worship'],
    [{ historic: 'church' }, 'building'],
    [{ place: 'square' }, 'square'],
    [{ bridge: 'yes' }, 'bridge'],
    [{ bridge: 'viaduct' }, 'bridge'],
  ] as const)('%j -> %s', (tags, kind) => {
    expect(classifyKind({ ...tags })).toBe(kind);
  });

  it('returns other for unknown or empty tags', () => {
    expect(classifyKind({})).toBe('other');
    expect(classifyKind({ historic: 'something_new' })).toBe('other');
    expect(classifyKind({ tourism: 'attraction' })).toBe('other');
  });

  it('does not treat bridge=no as a bridge', () => {
    expect(classifyKind({ bridge: 'no' })).toBe('other');
  });

  it('lets castle and archaeological_site win over worship and museum tags', () => {
    expect(classifyKind({ historic: 'castle', tourism: 'museum' })).toBe('castle');
    expect(classifyKind({ historic: 'archaeological_site', amenity: 'place_of_worship' })).toBe('archaeological_site');
  });

  it('prefers museum, worship and bridge over generic historic values', () => {
    expect(classifyKind({ historic: 'building', tourism: 'museum' })).toBe('museum');
    expect(classifyKind({ historic: 'building', amenity: 'place_of_worship' })).toBe('place_of_worship');
    expect(classifyKind({ historic: 'monument', bridge: 'yes' })).toBe('bridge');
  });
});
