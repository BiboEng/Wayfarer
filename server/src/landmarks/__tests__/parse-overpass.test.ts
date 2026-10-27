import { describe, expect, it } from 'vitest';
import { distanceMeters } from '@shared/geo/distance';
import { mergeLandmarks } from '../merge';
import { parseOverpass } from '../parse-overpass';
import { parseWikipediaPages } from '../parse-wikipedia';
import istanbulWiki from '../__fixtures__/wikipedia-istanbul.json';
// Hand-made (the public Overpass servers were unavailable when recording); see record.ts to replace it.
import istanbulOsm from '../__fixtures__/overpass-istanbul.handmade.json';

describe('parseOverpass (hand-made Istanbul fixture)', () => {
  const landmarks = parseOverpass(istanbulOsm);
  const byId = (id: string) => landmarks.find((l) => l.id === id);

  it('drops unnamed elements and elements without coordinates', () => {
    expect(byId('osm:node/4004')).toBeUndefined();
    expect(byId('osm:node/7007')).toBeUndefined();
    expect(landmarks).toHaveLength(5);
  });

  it('parses a node with lat/lon, its wikidata id, kind and selected tags only', () => {
    expect(byId('osm:node/1001')).toEqual({
      id: 'osm:node/1001',
      name: 'Ayasofya',
      location: { lat: 41.0085, lng: 28.9801 },
      kind: 'place_of_worship',
      wikidataId: 'Q12506',
      osmTags: {
        amenity: 'place_of_worship',
        historic: 'building',
        religion: 'muslim',
        wikidata: 'Q12506',
        wikipedia: 'tr:Ayasofya',
      },
    });
  });

  it('uses center for ways', () => {
    const way = byId('osm:way/2002');
    expect(way?.location).toEqual({ lat: 41.00806, lng: 28.97778 });
    expect(way?.kind).toBe('museum');
  });

  it('uses center for relations', () => {
    const relation = byId('osm:relation/3003');
    expect(relation?.location).toEqual({ lat: 41.0086, lng: 28.9799 });
    expect(relation?.kind).toBe('historic_district');
  });

  it('ignores a malformed wikidata value and non-string tags', () => {
    const bridge = byId('osm:node/6006');
    expect(bridge).not.toHaveProperty('wikidataId');
    expect(bridge?.kind).toBe('bridge');
  });

  it('keeps the far same-name element as a separate landmark', () => {
    expect(byId('osm:node/5005')?.location.lat).toBeCloseTo(40.6333);
  });
});

describe('parseOverpass + mergeLandmarks on the Istanbul fixtures', () => {
  const center = { lat: 41.0086, lng: 28.9802 };
  const merged = mergeLandmarks(parseWikipediaPages(istanbulWiki), parseOverpass(istanbulOsm), center);

  it('lists Hagia Sophia once, merged by wikidata despite the Turkish OSM name', () => {
    const hits = merged.filter((l) => l.wikidataId === 'Q12506');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'wiki:42764', name: 'Hagia Sophia', kind: 'place_of_worship' });
  });

  it('merges the Basilica Cistern through its english wikipedia tag or wikidata', () => {
    expect(merged.filter((l) => l.wikidataId === 'Q216511')).toHaveLength(1);
  });

  it('does not merge the same-named element in another city', () => {
    expect(merged.find((l) => l.id === 'osm:node/5005')).toBeDefined();
  });

  it('is sorted nearest first', () => {
    const distances = merged.map((l) => distanceMeters(center, l.location));
    expect(distances).toEqual([...distances].sort((x, y) => x - y));
  });
});

describe('parseOverpass (shapes)', () => {
  it.each([null, undefined, 'x', 3, [], {}, { elements: 'no' }, { elements: [null, 5, 'x', {}] }])(
    'returns [] for malformed input %j',
    (input) => {
      expect(parseOverpass(input)).toEqual([]);
    },
  );

  it('rejects an unknown element type and a missing id', () => {
    const json = {
      elements: [
        { type: 'area', id: 1, lat: 1, lon: 1, tags: { name: 'A' } },
        { type: 'node', lat: 1, lon: 1, tags: { name: 'B' } },
      ],
    };
    expect(parseOverpass(json)).toEqual([]);
  });

  it('trims names and rejects blank ones', () => {
    const json = {
      elements: [
        { type: 'node', id: 1, lat: 1, lon: 2, tags: { name: '  Spaced  ' } },
        { type: 'node', id: 2, lat: 1, lon: 2, tags: { name: '   ' } },
      ],
    };
    expect(parseOverpass(json).map((l) => l.name)).toEqual(['Spaced']);
  });

  it('maps an empty ocean answer to no landmarks', () => {
    expect(parseOverpass({ version: 0.6, elements: [] })).toEqual([]);
  });
});
