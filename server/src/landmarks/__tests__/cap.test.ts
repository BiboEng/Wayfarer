import { describe, expect, it } from 'vitest';
import { HAGIA_SOPHIA, northOf, osmLandmark, wikiLandmark } from '../__fixtures__/builders';
import { capOsmOnly, MAX_OSM_ONLY } from '../cap';

const osmList = (count: number, from = 0) =>
  Array.from({ length: count }, (_, i) =>
    osmLandmark({ id: `osm:node/${from + i}`, name: `OSM ${from + i}`, location: northOf(HAGIA_SOPHIA, (from + i) * 5) }),
  );

describe('capOsmOnly', () => {
  it('defaults to 60 OSM-only landmarks', () => {
    expect(MAX_OSM_ONLY).toBe(60);
    expect(capOsmOnly(osmList(100))).toHaveLength(60);
  });

  it('keeps the nearest OSM-only landmarks (input is nearest first)', () => {
    const result = capOsmOnly(osmList(10), 3);
    expect(result.map((l) => l.id)).toEqual(['osm:node/0', 'osm:node/1', 'osm:node/2']);
  });

  it('never drops a Wikipedia-backed landmark, even when far down the list', () => {
    const wiki = [1, 2, 3].map((n) => wikiLandmark({ pageId: n }));
    const input = [...osmList(5), wiki[0], ...osmList(5, 5), wiki[1], wiki[2]];
    const result = capOsmOnly(input, 2);
    expect(result.filter((l) => l.wikipedia)).toHaveLength(3);
    expect(result.filter((l) => !l.wikipedia)).toHaveLength(2);
  });

  it('does not count Wikipedia-backed landmarks against the OSM limit', () => {
    const input = [wikiLandmark({ pageId: 1 }), ...osmList(3), wikiLandmark({ pageId: 2 })];
    expect(capOsmOnly(input, 3)).toHaveLength(5);
  });

  it('keeps the input order', () => {
    const w = wikiLandmark({ pageId: 1 });
    const [a, b, c] = osmList(3);
    expect(capOsmOnly([a, w, b, c], 2)).toEqual([a, w, b]);
  });

  it('passes short lists through and handles empty input', () => {
    const list = osmList(3);
    expect(capOsmOnly(list)).toEqual(list);
    expect(capOsmOnly([])).toEqual([]);
  });

  it('with a limit of 0 keeps only Wikipedia-backed landmarks', () => {
    const w = wikiLandmark();
    expect(capOsmOnly([...osmList(3), w], 0)).toEqual([w]);
  });

  it('does not mutate its input', () => {
    const list = osmList(10);
    capOsmOnly(list, 2);
    expect(list).toHaveLength(10);
  });
});
