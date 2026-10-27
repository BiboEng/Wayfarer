import { describe, expect, it } from 'vitest';
import { distanceMeters } from '@shared/geo/distance';
import { HAGIA_SOPHIA, northOf, osmLandmark, wikiLandmark } from '../__fixtures__/builders';
import { mergeLandmarks, normalizeName, SAME_PLACE_DISTANCE_M, sortNearestFirst } from '../merge';

const CENTER = HAGIA_SOPHIA;

describe('normalizeName', () => {
  it('lowercases, strips Latin accents and punctuation, collapses spaces', () => {
    expect(normalizeName('  Ayasofya-i   Keb\u00eer, Camii! ')).toBe('ayasofya i kebir camii');
    expect(normalizeName('Caf\u00e9 M\u00fcnster')).toBe('cafe munster');
  });

  it('keeps Cyrillic letters intact (the short i with breve is not reduced to i)', () => {
    expect(normalizeName('\u0410\u0439\u044f-\u0421\u043e\u0444\u0438\u044f')).toBe('\u0430\u0439\u044f \u0441\u043e\u0444\u0438\u044f');
    expect(normalizeName('\u0410\u0439\u044f-\u0421\u043e\u0444\u0438\u044f')).not.toBe('\u0430\u0438\u044f \u0441\u043e\u0444\u0438\u044f');
  });

  it('keeps Arabic harakat (diacritics are part of the text)', () => {
    const result = normalizeName('\u0622\u064a\u064e\u0627 \u0635\u064f\u0648\u0641\u0650\u064a\u064e\u0627');
    expect(result).toContain('\u064e');
    expect(result).toContain('\u064f');
    expect(result).toContain('\u0650');
    expect(result).not.toBe(normalizeName('\u0622\u064a\u0627 \u0635\u0648\u0641\u064a\u0627'));
  });

  it('keeps other non-latin letters and digits', () => {
    expect(normalizeName('\u6545\u5bab-\u535a\u7269\u9662 2')).toBe('\u6545\u5bab \u535a\u7269\u9662 2');
  });

  it('returns an empty string for punctuation only', () => {
    expect(normalizeName('--- !!')).toBe('');
  });

  it('treats precomposed and decomposed Latin accents the same', () => {
    expect(normalizeName('Cafe\u0301')).toBe(normalizeName('Caf\u00e9'));
  });
});

describe('mergeLandmarks: merging', () => {
  it('merges by wikidata id even when names and positions differ', () => {
    const wiki = wikiLandmark({ wikidataId: 'Q12506', name: 'Hagia Sophia' });
    const osm = osmLandmark({
      wikidataId: 'Q12506',
      name: 'Ayasofya',
      location: northOf(HAGIA_SOPHIA, 900),
      kind: 'museum',
      osmTags: { tourism: 'museum', wikidata: 'Q12506' },
    });
    const result = mergeLandmarks([wiki], [osm], CENTER);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'wiki:1',
      name: 'Hagia Sophia',
      location: HAGIA_SOPHIA,
      kind: 'museum',
      wikidataId: 'Q12506',
      osmTags: { tourism: 'museum' },
    });
    expect(result[0].wikipedia).toEqual(wiki.wikipedia);
  });

  it('merges by an english wikipedia tag matching the page title', () => {
    const wiki = wikiLandmark({ name: 'Basilica Cistern', pageId: 5 });
    const osm = osmLandmark({
      name: 'Yerebatan Sarnıcı',
      location: northOf(HAGIA_SOPHIA, 400),
      osmTags: { wikipedia: 'en:Basilica_Cistern' },
    });
    const result = mergeLandmarks([wiki], [osm], CENTER);
    expect(result.map((l) => l.id)).toEqual(['wiki:5']);
  });

  it('merges by same normalized name within the distance limit', () => {
    const wiki = wikiLandmark({ name: 'Blue Mosque' });
    const osm = osmLandmark({ name: 'blue  mosque!', location: northOf(HAGIA_SOPHIA, SAME_PLACE_DISTANCE_M - 10) });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(1);
  });

  it('keeps the wikipedia id, text and location and takes the kind from OSM', () => {
    const wiki = wikiLandmark({ kind: 'other' });
    const osm = osmLandmark({ kind: 'castle', location: northOf(HAGIA_SOPHIA, 20) });
    const [merged] = mergeLandmarks([wiki], [osm], CENTER);
    expect(merged.id).toBe(wiki.id);
    expect(merged.location).toEqual(wiki.location);
    expect(merged.kind).toBe('castle');
    expect(merged.wikipedia).toEqual(wiki.wikipedia);
  });

  it('keeps the wikipedia kind when OSM says other', () => {
    const wiki = wikiLandmark({ kind: 'monument' });
    const osm = osmLandmark({ kind: 'other', osmTags: {} });
    expect(mergeLandmarks([wiki], [osm], CENTER)[0].kind).toBe('monument');
  });

  it('takes the wikidata id from OSM when Wikipedia has none', () => {
    const wiki = wikiLandmark({ name: 'Blue Mosque' });
    const osm = osmLandmark({ name: 'Blue Mosque', wikidataId: 'Q1' });
    expect(mergeLandmarks([wiki], [osm], CENTER)[0].wikidataId).toBe('Q1');
  });

  it('prefers the nearest candidate when several wikipedia pages match', () => {
    const near = wikiLandmark({ pageId: 1, name: 'Fountain', location: northOf(HAGIA_SOPHIA, 10) });
    const far = wikiLandmark({ pageId: 2, name: 'Fountain', location: northOf(HAGIA_SOPHIA, 60) });
    const osm = osmLandmark({ name: 'Fountain', location: HAGIA_SOPHIA });
    const result = mergeLandmarks([near, far], [osm], CENTER);
    const nearResult = result.find((l) => l.id === 'wiki:1');
    expect(nearResult?.osmTags).toBeDefined();
    expect(result.find((l) => l.id === 'wiki:2')?.osmTags).toBeUndefined();
  });

  it('applies the wikidata rule before the name rule', () => {
    const byName = wikiLandmark({ pageId: 1, name: 'Tower' });
    const byId = wikiLandmark({ pageId: 2, name: 'Galata', wikidataId: 'Q9', location: northOf(HAGIA_SOPHIA, 500) });
    const osm = osmLandmark({ name: 'Tower', wikidataId: 'Q9' });
    const result = mergeLandmarks([byName, byId], [osm], CENTER);
    expect(result.find((l) => l.id === 'wiki:2')?.osmTags).toBeDefined();
    expect(result.find((l) => l.id === 'wiki:1')?.osmTags).toBeUndefined();
  });
});

describe('mergeLandmarks: not merging', () => {
  it('does not merge same names that are far apart', () => {
    const wiki = wikiLandmark({ name: 'Saint George Church' });
    const osm = osmLandmark({ name: 'Saint George Church', location: northOf(HAGIA_SOPHIA, 5000) });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(2);
  });

  it('does not merge same names just beyond the distance limit', () => {
    const wiki = wikiLandmark({ name: 'Mosque' });
    const osm = osmLandmark({ name: 'Mosque', location: northOf(HAGIA_SOPHIA, SAME_PLACE_DISTANCE_M + 15) });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(2);
  });

  it('does not merge close places with different names', () => {
    const wiki = wikiLandmark({ name: 'Hagia Sophia' });
    const osm = osmLandmark({ name: 'Hagia Irene', location: northOf(HAGIA_SOPHIA, 20) });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(2);
  });

  it('does not use a non-english wikipedia tag', () => {
    const wiki = wikiLandmark({ name: 'Basilica Cistern', location: northOf(HAGIA_SOPHIA, 500) });
    const osm = osmLandmark({ name: 'Yerebatan', osmTags: { wikipedia: 'tr:Basilica Cistern' } });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(2);
  });

  it('does not merge different wikidata ids that share a name and place', () => {
    // Different ids but same name and place still merge by the name rule; with a different name they must not.
    const wiki = wikiLandmark({ name: 'A', wikidataId: 'Q1' });
    const osm = osmLandmark({ name: 'B', wikidataId: 'Q2' });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(2);
  });

  it('never merges names that normalize to nothing', () => {
    const wiki = wikiLandmark({ name: '---' });
    const osm = osmLandmark({ name: '!!!' });
    expect(mergeLandmarks([wiki], [osm], CENTER)).toHaveLength(2);
  });

  it('keeps two wikipedia articles apart even if they share a name and place', () => {
    const a = wikiLandmark({ pageId: 1, name: 'Same' });
    const b = wikiLandmark({ pageId: 2, name: 'Same' });
    expect(mergeLandmarks([a, b], [], CENTER)).toHaveLength(2);
  });
});

describe('mergeLandmarks: OSM-only duplicates', () => {
  it('collapses OSM duplicates with the same wikidata id', () => {
    const a = osmLandmark({ id: 'osm:node/1', name: 'Hagia Sophia', wikidataId: 'Q12506' });
    const b = osmLandmark({ id: 'osm:way/2', name: 'Ayasofya', wikidataId: 'Q12506', location: northOf(HAGIA_SOPHIA, 300) });
    const result = mergeLandmarks([], [a, b], CENTER);
    expect(result.map((l) => l.id)).toEqual(['osm:node/1']);
  });

  it('collapses OSM duplicates with the same name close together', () => {
    const a = osmLandmark({ id: 'osm:node/1', name: 'Fountain' });
    const b = osmLandmark({ id: 'osm:way/2', name: 'Fountain', location: northOf(HAGIA_SOPHIA, 30) });
    expect(mergeLandmarks([], [a, b], CENTER)).toHaveLength(1);
  });

  it('keeps OSM same-name features that are far apart', () => {
    const a = osmLandmark({ id: 'osm:node/1', name: 'Fountain' });
    const b = osmLandmark({ id: 'osm:node/2', name: 'Fountain', location: northOf(HAGIA_SOPHIA, 800) });
    expect(mergeLandmarks([], [a, b], CENTER)).toHaveLength(2);
  });

  it('keeps a lone OSM landmark', () => {
    const osm = osmLandmark();
    expect(mergeLandmarks([], [osm], CENTER)).toEqual([osm]);
  });
});

describe('mergeLandmarks: ordering and inputs', () => {
  it('returns nearest first', () => {
    const far = wikiLandmark({ pageId: 1, name: 'Far', location: northOf(HAGIA_SOPHIA, 900) });
    const mid = osmLandmark({ id: 'osm:node/9', name: 'Mid', location: northOf(HAGIA_SOPHIA, 300) });
    const near = wikiLandmark({ pageId: 2, name: 'Near', location: northOf(HAGIA_SOPHIA, 10) });
    expect(mergeLandmarks([far, near], [mid], CENTER).map((l) => l.name)).toEqual(['Near', 'Mid', 'Far']);
  });

  it('handles empty inputs', () => {
    expect(mergeLandmarks([], [], CENTER)).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const wiki = [wikiLandmark({ name: 'Blue Mosque' })];
    const osm = [osmLandmark({ name: 'Blue Mosque' })];
    const wikiBefore = JSON.stringify(wiki);
    mergeLandmarks(wiki, osm, CENTER);
    expect(JSON.stringify(wiki)).toBe(wikiBefore);
  });
});

describe('sortNearestFirst', () => {
  it('sorts by distance without mutating the input', () => {
    const a = wikiLandmark({ pageId: 1, location: northOf(HAGIA_SOPHIA, 500) });
    const b = wikiLandmark({ pageId: 2, location: northOf(HAGIA_SOPHIA, 100) });
    const input = [a, b];
    const sorted = sortNearestFirst(input, CENTER);
    expect(sorted.map((l) => l.id)).toEqual(['wiki:2', 'wiki:1']);
    expect(input[0]).toBe(a);
    expect(distanceMeters(CENTER, sorted[0].location)).toBeLessThan(distanceMeters(CENTER, sorted[1].location));
  });
});
