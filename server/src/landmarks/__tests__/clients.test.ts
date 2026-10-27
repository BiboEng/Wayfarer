import { describe, expect, it, vi } from 'vitest';
import type { UpstreamHttp } from '../http';
import { LandmarkUpstreamError } from '../landmark-upstream-error';
import { buildAroundQuery, buildByIdQuery, buildByWikidataQuery, createOverpassClient } from '../overpass-client';
import { buildGeoSearchUrl, buildPageIdUrl, createWikipediaClient, WIKIPEDIA_MAX_PAGES } from '../wikipedia-client';

const ISTANBUL = { lat: 41.0086, lng: 28.9802 };

describe('buildGeoSearchUrl', () => {
  const url = new URL(buildGeoSearchUrl(ISTANBUL, 400));

  it('targets the English Wikipedia API with the geosearch generator', () => {
    expect(url.origin + url.pathname).toBe('https://en.wikipedia.org/w/api.php');
    expect(url.searchParams.get('generator')).toBe('geosearch');
    expect(url.searchParams.get('formatversion')).toBe('2');
    expect(url.searchParams.get('ggscoord')).toBe('41.0086|28.9802');
    expect(url.searchParams.get('ggsradius')).toBe('400');
    expect(url.searchParams.get('ggslimit')).toBe(String(WIKIPEDIA_MAX_PAGES));
    expect(url.searchParams.get('ggsnamespace')).toBe('0');
  });

  it('asks for the intro as plain text and for the wikidata id', () => {
    expect(url.searchParams.get('explaintext')).toBe('1');
    expect(url.searchParams.get('exintro')).toBe('1');
    expect(url.searchParams.get('ppprop')).toContain('wikibase_item');
  });

  it('clamps the radius to the 10..10000 range GeoSearch accepts', () => {
    expect(new URL(buildGeoSearchUrl(ISTANBUL, 5)).searchParams.get('ggsradius')).toBe('10');
    expect(new URL(buildGeoSearchUrl(ISTANBUL, 50_000)).searchParams.get('ggsradius')).toBe('10000');
    expect(new URL(buildGeoSearchUrl(ISTANBUL, 400.6)).searchParams.get('ggsradius')).toBe('401');
  });
});

describe('buildPageIdUrl', () => {
  it('requests one page id', () => {
    expect(new URL(buildPageIdUrl(42764.9)).searchParams.get('pageids')).toBe('42764');
  });
});

describe('buildAroundQuery', () => {
  const query = buildAroundQuery(ISTANBUL, 400.4);

  it('has the json header and a center output', () => {
    expect(query).toContain('[out:json]');
    expect(query).toContain('out center tags;');
  });

  it('uses the rounded radius and the coordinates in every statement', () => {
    const statements = query.split('\n').filter((l) => l.includes('around:'));
    expect(statements.length).toBeGreaterThan(3);
    for (const line of statements) expect(line).toContain('(around:400,41.0086,28.9802)');
  });

  it('only asks for named features and ignores roadside markers', () => {
    for (const line of query.split('\n').filter((l) => l.includes('around:'))) expect(line).toContain('["name"]');
    expect(query).toContain('boundary_stone');
  });

  it('rejects non-finite input', () => {
    expect(() => buildAroundQuery({ lat: NaN, lng: 0 }, 100)).toThrow(RangeError);
    expect(() => buildAroundQuery(ISTANBUL, Infinity)).toThrow(RangeError);
  });
});

describe('buildByIdQuery', () => {
  it('builds a single element query', () => {
    expect(buildByIdQuery('way', 678)).toContain('way(678);');
  });

  it('rejects non-finite ids', () => {
    expect(() => buildByIdQuery('node', NaN)).toThrow(RangeError);
  });
});

function fakeHttp(answer: unknown): { http: UpstreamHttp; getJson: ReturnType<typeof vi.fn> } {
  const getJson = vi.fn(() => Promise.resolve(answer));
  return { http: { getJson } as UpstreamHttp, getJson };
}

describe('createWikipediaClient', () => {
  it('returns the JSON of a good response', async () => {
    const { http, getJson } = fakeHttp({ query: { pages: [] } });
    const result = await createWikipediaClient(http).geoSearch(ISTANBUL, 400);
    expect(result).toEqual({ query: { pages: [] } });
    expect(getJson.mock.calls[0][0]).toMatchObject({ url: expect.stringContaining('ggscoord') });
  });

  it('turns an API error object into LandmarkUpstreamError', async () => {
    const { http } = fakeHttp({ error: { code: 'x', info: 'private detail' } });
    const error = await createWikipediaClient(http).byPageId(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LandmarkUpstreamError);
    expect((error as Error).message).not.toContain('private detail');
  });

  it('rejects a non-object response', async () => {
    const { http } = fakeHttp('nope');
    await expect(createWikipediaClient(http).geoSearch(ISTANBUL, 400)).rejects.toBeInstanceOf(LandmarkUpstreamError);
  });
});

describe('createOverpassClient', () => {
  const URL_ = 'https://overpass.example.org/api/interpreter';

  it('POSTs the form-encoded query to the configured endpoint', async () => {
    const { http, getJson } = fakeHttp({ elements: [] });
    await createOverpassClient(http, URL_).around(ISTANBUL, 400);
    const request = getJson.mock.calls[0][0] as { url: string; method: string; body: string };
    expect(request.url).toBe(URL_);
    expect(request.method).toBe('POST');
    expect(request.body.startsWith('data=')).toBe(true);
    expect(decodeURIComponent(request.body.slice(5))).toContain('around:400');
  });

  it('accepts a complete response', async () => {
    const { http } = fakeHttp({ elements: [{ type: 'node', id: 1 }] });
    expect(await createOverpassClient(http, URL_).byId('node', 1)).toEqual({ elements: [{ type: 'node', id: 1 }] });
  });

  it('rejects a response without elements', async () => {
    const { http } = fakeHttp({ version: 0.6 });
    await expect(createOverpassClient(http, URL_).around(ISTANBUL, 400)).rejects.toBeInstanceOf(LandmarkUpstreamError);
  });

  it('rejects a partial answer carrying a runtime error remark', async () => {
    const { http } = fakeHttp({ elements: [{ type: 'node', id: 1 }], remark: 'runtime error: Query timed out' });
    await expect(createOverpassClient(http, URL_).around(ISTANBUL, 400)).rejects.toBeInstanceOf(LandmarkUpstreamError);
  });

  it('ignores harmless remarks', async () => {
    const { http } = fakeHttp({ elements: [], remark: 'note' });
    await expect(createOverpassClient(http, URL_).around(ISTANBUL, 400)).resolves.toBeDefined();
  });
});

describe('buildByWikidataQuery', () => {
  it('asks for features with that wikidata id and outputs center and tags', () => {
    const query = buildByWikidataQuery('Q12506');
    expect(query).toContain('[out:json]');
    expect(query).toContain('nwr["wikidata"="Q12506"];');
    expect(query).toContain('out center tags;');
  });

  it.each(['', 'Q', 'q12506', 'Q12506"];out;', 'Q1 2', 'P31', 'Q-5'])('rejects the invalid id %j (no query injection)', (id) => {
    expect(() => buildByWikidataQuery(id)).toThrow(RangeError);
  });
});

describe('createOverpassClient.byWikidata', () => {
  it('POSTs the wikidata query without retry', async () => {
    const getJson = vi.fn(() => Promise.resolve({ elements: [] }));
    await createOverpassClient({ getJson } as UpstreamHttp, 'https://overpass.example.org/api/interpreter').byWikidata('Q42');
    const request = (getJson.mock.calls[0] as unknown as [{ method: string; body: string; retry: boolean }])[0];
    expect(request.method).toBe('POST');
    expect(request.retry).toBe(false);
    expect(decodeURIComponent(request.body)).toContain('"wikidata"="Q42"');
  });

  it('never retries around and byId requests either', async () => {
    const getJson = vi.fn(() => Promise.resolve({ elements: [] }));
    const client = createOverpassClient({ getJson } as UpstreamHttp, 'https://overpass.example.org/api/interpreter');
    await client.around({ lat: 1, lng: 2 }, 100);
    await client.byId('node', 5);
    for (const call of getJson.mock.calls as unknown as Array<[{ retry: boolean }]>) expect(call[0].retry).toBe(false);
  });
});

describe('createWikipediaClient.geoSearch deadline', () => {
  it('passes the deadline on to the http layer', async () => {
    const getJson = vi.fn(() => Promise.resolve({ query: {} }));
    await createWikipediaClient({ getJson } as UpstreamHttp).geoSearch(ISTANBUL, 400, undefined, 12345);
    expect((getJson.mock.calls[0] as unknown as [{ deadlineAt: number }])[0].deadlineAt).toBe(12345);
  });
});
