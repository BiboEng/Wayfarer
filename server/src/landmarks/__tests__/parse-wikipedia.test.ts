import { describe, expect, it } from 'vitest';
import { WIKIPEDIA_EXTRACT_MAX_CHARS } from '@shared/landmarks/search';
import { parseWikipediaPages, truncateExtract } from '../parse-wikipedia';
import istanbul from '../__fixtures__/wikipedia-istanbul.json';
import ocean from '../__fixtures__/wikipedia-ocean.json';
import rural from '../__fixtures__/wikipedia-rural.json';

function page(overrides: Record<string, unknown> = {}) {
  return {
    pageid: 7,
    title: 'Some Place',
    fullurl: 'https://en.wikipedia.org/wiki/Some_Place',
    extract: 'A place.',
    coordinates: [{ lat: 10, lon: 20, primary: true }],
    pageprops: { wikibase_item: 'Q42' },
    ...overrides,
  };
}
const wrap = (...pages: unknown[]) => ({ query: { pages } });

describe('parseWikipediaPages (recorded responses)', () => {
  it('parses the Istanbul fixture into Wikipedia-backed landmarks', () => {
    const landmarks = parseWikipediaPages(istanbul);
    expect(landmarks.length).toBeGreaterThan(0);
    const hagia = landmarks.find((l) => l.name === 'Hagia Sophia');
    expect(hagia).toMatchObject({
      id: 'wiki:42764',
      kind: 'other',
      wikidataId: 'Q12506',
      wikipedia: { pageId: 42764, title: 'Hagia Sophia' },
    });
    expect(hagia?.location.lat).toBeCloseTo(41.0083, 3);
    expect(hagia?.wikipedia?.url).toMatch(/^https:\/\/en\.wikipedia\.org\//);
    for (const landmark of landmarks) {
      expect(landmark.wikipedia).toBeDefined();
      expect(landmark.wikipedia?.extract.length).toBeLessThanOrEqual(WIKIPEDIA_EXTRACT_MAX_CHARS);
    }
  });

  it('caps the long recorded Hagia Sophia extract', () => {
    const hagia = parseWikipediaPages(istanbul).find((l) => l.name === 'Hagia Sophia');
    expect(hagia?.wikipedia?.extract.length).toBeLessThanOrEqual(WIKIPEDIA_EXTRACT_MAX_CHARS);
    expect(hagia?.wikipedia?.extract.length).toBeGreaterThan(500);
  });

  it('handles the sparse and the empty fixtures', () => {
    expect(Array.isArray(parseWikipediaPages(rural))).toBe(true);
    expect(parseWikipediaPages(ocean)).toEqual([]);
  });
});

describe('parseWikipediaPages (shapes)', () => {
  it('maps the fields of one page', () => {
    const [landmark] = parseWikipediaPages(wrap(page({ thumbnail: { source: 'https://img.example/t.jpg' } })));
    expect(landmark).toEqual({
      id: 'wiki:7',
      name: 'Some Place',
      location: { lat: 10, lng: 20 },
      kind: 'other',
      wikidataId: 'Q42',
      wikipedia: {
        pageId: 7,
        title: 'Some Place',
        url: 'https://en.wikipedia.org/wiki/Some_Place',
        extract: 'A place.',
        thumbnailUrl: 'https://img.example/t.jpg',
      },
    });
  });

  it('builds the article url when fullurl is absent', () => {
    const [landmark] = parseWikipediaPages(wrap(page({ fullurl: undefined, title: 'Blue Mosque (Istanbul)' })));
    expect(landmark.wikipedia?.url).toBe('https://en.wikipedia.org/wiki/Blue_Mosque_(Istanbul)');
  });

  it('omits wikidataId and thumbnail when missing or malformed', () => {
    const [landmark] = parseWikipediaPages(wrap(page({ pageprops: { wikibase_item: 'not-an-id' } })));
    expect(landmark).not.toHaveProperty('wikidataId');
    expect(landmark.wikipedia).not.toHaveProperty('thumbnailUrl');
  });

  it('uses an empty extract when the page has none', () => {
    const [landmark] = parseWikipediaPages(wrap(page({ extract: undefined })));
    expect(landmark.wikipedia?.extract).toBe('');
  });

  it('skips pages without usable coordinates', () => {
    expect(parseWikipediaPages(wrap(page({ coordinates: undefined })))).toEqual([]);
    expect(parseWikipediaPages(wrap(page({ coordinates: [] })))).toEqual([]);
    expect(parseWikipediaPages(wrap(page({ coordinates: [{ lat: 'x', lon: 1 }] })))).toEqual([]);
  });

  it('skips disambiguation pages', () => {
    expect(parseWikipediaPages(wrap(page({ pageprops: { disambiguation: '' } })))).toEqual([]);
  });

  it('skips missing pages and pages without id or title', () => {
    expect(parseWikipediaPages(wrap(page({ missing: true })))).toEqual([]);
    expect(parseWikipediaPages(wrap(page({ pageid: undefined })))).toEqual([]);
    expect(parseWikipediaPages(wrap(page({ title: '' })))).toEqual([]);
  });

  it('keeps good pages next to bad ones', () => {
    const result = parseWikipediaPages(wrap(null, 'junk', page({ pageid: 1 }), page({ pageid: 2, coordinates: [] })));
    expect(result.map((l) => l.id)).toEqual(['wiki:1']);
  });

  it('accepts the object form of pages', () => {
    expect(parseWikipediaPages({ query: { pages: { '7': page() } } })).toHaveLength(1);
  });

  it.each([null, undefined, 'x', 5, [], {}, { query: null }, { query: {} }, { query: { pages: 'no' } }])(
    'returns [] for malformed input %j',
    (input) => {
      expect(parseWikipediaPages(input)).toEqual([]);
    },
  );
});

describe('truncateExtract', () => {
  it('returns short text trimmed', () => {
    expect(truncateExtract('  hello  ', 100)).toBe('hello');
  });

  it('cuts at the last sentence end past the halfway mark', () => {
    const text = 'First sentence is here. Second sentence is longer and keeps going without end';
    expect(truncateExtract(text, 40)).toBe('First sentence is here.');
  });

  it('falls back to a word boundary when the only sentence end is too early', () => {
    const result = truncateExtract('Hi. ' + 'word '.repeat(30), 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('word')).toBe(true);
  });

  it('hard-cuts text without any space', () => {
    expect(truncateExtract('x'.repeat(100), 10)).toBe('x'.repeat(10));
  });

  it('defaults to the shared cap', () => {
    expect(truncateExtract('a '.repeat(3000)).length).toBeLessThanOrEqual(WIKIPEDIA_EXTRACT_MAX_CHARS);
  });
});
