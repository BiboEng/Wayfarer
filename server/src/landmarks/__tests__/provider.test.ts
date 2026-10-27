import { describe, expect, it, vi } from 'vitest';
import istanbulWiki from '../__fixtures__/wikipedia-istanbul.json';
import oceanWiki from '../__fixtures__/wikipedia-ocean.json';
import istanbulOsm from '../__fixtures__/overpass-istanbul.handmade.json';
import { LandmarkUpstreamError } from '../landmark-upstream-error';
import { createWikiOsmProvider, OVERPASS_MAX_RADIUS_M } from '../provider';

const OVERPASS_URL = 'https://overpass.example.org/api/interpreter';
const CENTER = { lat: 41.0086, lng: 28.9802 };

type Reply = () => Response | Promise<Response>;
const ok = (body: unknown): Reply => () => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number): Reply => () => new Response('{}', { status: code });

/** Routes by URL; never touches the network. */
function makeProvider(routes: { wikipedia?: Reply; overpass?: Reply }) {
  const fetchFn = vi.fn<typeof fetch>((input) => {
    const url = String(input);
    const reply = url.startsWith(OVERPASS_URL) ? routes.overpass : url.startsWith('https://en.wikipedia.org/') ? routes.wikipedia : undefined;
    if (!reply) return Promise.reject(new Error(`unexpected request to ${url}`));
    return Promise.resolve(reply());
  });
  const provider = createWikiOsmProvider({
    contact: 'test@example.com',
    overpassUrl: OVERPASS_URL,
    fetchFn,
    sleep: () => Promise.resolve(),
    now: () => 0,
  });
  const calls = (host: 'wikipedia' | 'overpass') =>
    fetchFn.mock.calls.filter(([input]) => String(input).includes(host === 'overpass' ? 'overpass.example.org' : 'wikipedia.org'));
  return { provider, fetchFn, calls };
}

describe('createWikiOsmProvider.findNearby', () => {
  it('merges Wikipedia and Overpass results, each place once, nearest first', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok(istanbulOsm) });
    const result = await provider.findNearby({ center: CENTER, radiusMeters: 400 });
    expect(result.filter((l) => l.wikidataId === 'Q12506')).toHaveLength(1);
    expect(result.find((l) => l.wikidataId === 'Q12506')?.id).toBe('wiki:42764');
    expect(result.some((l) => l.id.startsWith('osm:'))).toBe(true);
  });

  it('sends the User-Agent with the contact on both upstreams', async () => {
    const { provider, fetchFn } = makeProvider({ wikipedia: ok(oceanWiki), overpass: ok({ elements: [] }) });
    await provider.findNearby({ center: CENTER, radiusMeters: 400 });
    for (const [, init] of fetchFn.mock.calls) {
      expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/^Wayfarer\/.+ \(test@example\.com\)$/);
    }
  });

  it('returns Wikipedia-only results when Overpass fails', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: status(502) });
    const result = await provider.findNearby({ center: CENTER, radiusMeters: 400 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((l) => l.id.startsWith('wiki:'))).toBe(true);
  });

  it('returns Wikipedia-only results when Overpass returns a partial answer', async () => {
    const { provider } = makeProvider({
      wikipedia: ok(istanbulWiki),
      overpass: ok({ elements: [], remark: 'runtime error: out of memory' }),
    });
    const result = await provider.findNearby({ center: CENTER, radiusMeters: 400 });
    expect(result.every((l) => l.id.startsWith('wiki:'))).toBe(true);
  });

  it('returns OSM-only results when Wikipedia fails but Overpass works', async () => {
    const { provider } = makeProvider({ wikipedia: status(500), overpass: ok(istanbulOsm) });
    const result = await provider.findNearby({ center: CENTER, radiusMeters: 400 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((l) => l.id.startsWith('osm:'))).toBe(true);
  });

  it('throws LandmarkUpstreamError when both sources fail', async () => {
    const { provider } = makeProvider({ wikipedia: status(503), overpass: status(503) });
    await expect(provider.findNearby({ center: CENTER, radiusMeters: 400 })).rejects.toBeInstanceOf(LandmarkUpstreamError);
  });

  it('throws LandmarkUpstreamError when Wikipedia fails and Overpass was skipped', async () => {
    const { provider, calls } = makeProvider({ wikipedia: status(503) });
    await expect(
      provider.findNearby({ center: CENTER, radiusMeters: OVERPASS_MAX_RADIUS_M + 1 }),
    ).rejects.toBeInstanceOf(LandmarkUpstreamError);
    expect(calls('overpass')).toHaveLength(0);
  });

  it('returns an empty list, not an error, for the empty ocean', async () => {
    const { provider } = makeProvider({ wikipedia: ok(oceanWiki), overpass: ok({ elements: [] }) });
    expect(await provider.findNearby({ center: { lat: 0, lng: -30 }, radiusMeters: 2000 })).toEqual([]);
  });

  it('skips Overpass above its maximum radius but still asks it at the maximum', async () => {
    const above = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok(istanbulOsm) });
    const result = await above.provider.findNearby({ center: CENTER, radiusMeters: OVERPASS_MAX_RADIUS_M + 1 });
    expect(above.calls('overpass')).toHaveLength(0);
    expect(result.every((l) => l.id.startsWith('wiki:'))).toBe(true);

    const at = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok(istanbulOsm) });
    await at.provider.findNearby({ center: CENTER, radiusMeters: OVERPASS_MAX_RADIUS_M });
    expect(at.calls('overpass')).toHaveLength(1);
  });

  it('applies the limit', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok(istanbulOsm) });
    expect(await provider.findNearby({ center: CENTER, radiusMeters: 400, limit: 2 })).toHaveLength(2);
  });

  it('rethrows the abort reason, not an upstream error, when the caller aborted', async () => {
    const controller = new AbortController();
    const { provider } = makeProvider({
      wikipedia: () => {
        controller.abort(new Error('client left'));
        return new Response('{}', { status: 500 });
      },
      overpass: status(500),
    });
    await expect(provider.findNearby({ center: CENTER, radiusMeters: 400 }, controller.signal)).rejects.toThrow(
      'client left',
    );
  });
});

describe('createWikiOsmProvider.getById', () => {
  it('loads a wiki: id from Wikipedia by page id', async () => {
    const { provider, calls } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok({ elements: [] }) });
    const hagia = await provider.getById('wiki:42764');
    expect(hagia?.name).toBe('Hagia Sophia');
    const url = new URL(String(calls('wikipedia')[0][0]));
    expect(url.searchParams.get('pageids')).toBe('42764');
  });

  it('enriches a wiki: landmark with kind and tags from the OSM element with the same wikidata id', async () => {
    const { provider, calls } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok({ elements: [istanbulOsm.elements[0]] }) });
    const hagia = await provider.getById('wiki:42764');
    expect(hagia).toMatchObject({ id: 'wiki:42764', kind: 'place_of_worship', osmTags: { amenity: 'place_of_worship' } });
    const body = decodeURIComponent(String(calls('overpass')[0][1]?.body));
    expect(body).toContain('"wikidata"="Q12506"');
  });

  it('keeps kind other when the enrichment call to Overpass fails', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: status(502) });
    const hagia = await provider.getById('wiki:42764');
    expect(hagia).toMatchObject({ id: 'wiki:42764', name: 'Hagia Sophia', kind: 'other' });
  });

  it('does not ask Overpass for a landmark without a wikidata id', async () => {
    const page = { ...istanbulWiki.query.pages[0], pageprops: {} };
    const { provider, calls } = makeProvider({ wikipedia: ok({ query: { pages: [page] } }) });
    expect((await provider.getById('wiki:42764'))?.kind).toBe('other');
    expect(calls('overpass')).toHaveLength(0);
  });

  it('returns null when Wikipedia has no such page', async () => {
    const { provider } = makeProvider({ wikipedia: ok(oceanWiki) });
    expect(await provider.getById('wiki:1')).toBeNull();
  });

  it('loads an osm: id from Overpass by element', async () => {
    const element = istanbulOsm.elements[1];
    const { provider, calls } = makeProvider({ overpass: ok({ elements: [element] }) });
    const landmark = await provider.getById('osm:way/2002');
    expect(landmark?.id).toBe('osm:way/2002');
    const body = decodeURIComponent(String(calls('overpass')[0][1]?.body));
    expect(body).toContain('way(2002);');
    expect(calls('wikipedia')).toHaveLength(0);
  });

  it('returns null when the OSM element is gone', async () => {
    const { provider } = makeProvider({ overpass: ok({ elements: [] }) });
    expect(await provider.getById('osm:node/5')).toBeNull();
  });

  it.each(['', 'wiki:', 'wiki:abc', 'osm:area/5', 'osm:way/', 'google:5', 'wiki:1; drop', 'osm:way/1)out;'])(
    'returns null for the invalid id %j without any request',
    async (id) => {
      const { provider, fetchFn } = makeProvider({});
      expect(await provider.getById(id)).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('propagates upstream failures as LandmarkUpstreamError', async () => {
    const { provider } = makeProvider({ wikipedia: status(503) });
    await expect(provider.getById('wiki:1')).rejects.toBeInstanceOf(LandmarkUpstreamError);
  });
});

describe('createWikiOsmProvider.findNearbyDetailed', () => {
  it('is not partial when both sources answer', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok(istanbulOsm) });
    const result = await provider.findNearbyDetailed({ center: CENTER, radiusMeters: 400 });
    expect(result.partial).toBe(false);
    expect(result.landmarks.length).toBeGreaterThan(0);
  });

  it('is partial when Overpass fails', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: status(502) });
    const result = await provider.findNearbyDetailed({ center: CENTER, radiusMeters: 400 });
    expect(result.partial).toBe(true);
    expect(result.landmarks.every((l) => l.id.startsWith('wiki:'))).toBe(true);
  });

  it('is partial when Wikipedia fails', async () => {
    const { provider } = makeProvider({ wikipedia: status(500), overpass: ok(istanbulOsm) });
    const result = await provider.findNearbyDetailed({ center: CENTER, radiusMeters: 400 });
    expect(result.partial).toBe(true);
    expect(result.landmarks.every((l) => l.id.startsWith('osm:'))).toBe(true);
  });

  it('is not partial when Overpass was skipped on purpose (large radius)', async () => {
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki) });
    const result = await provider.findNearbyDetailed({ center: CENTER, radiusMeters: OVERPASS_MAX_RADIUS_M + 1 });
    expect(result.partial).toBe(false);
  });

  it('is not partial for an empty but successful answer', async () => {
    const { provider } = makeProvider({ wikipedia: ok(oceanWiki), overpass: ok({ elements: [] }) });
    expect(await provider.findNearbyDetailed({ center: { lat: 0, lng: -30 }, radiusMeters: 2000 })).toEqual({
      landmarks: [],
      partial: false,
    });
  });

  it('throws LandmarkUpstreamError when both fail', async () => {
    const { provider } = makeProvider({ wikipedia: status(503), overpass: status(503) });
    await expect(provider.findNearbyDetailed({ center: CENTER, radiusMeters: 400 })).rejects.toBeInstanceOf(
      LandmarkUpstreamError,
    );
  });

  it('never makes more than one Overpass request for a failing around-query (no retry)', async () => {
    const { provider, calls } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: status(503) });
    await provider.findNearbyDetailed({ center: CENTER, radiusMeters: 400 });
    expect(calls('overpass')).toHaveLength(1);
  });

  it('caps OSM-only landmarks at 60 but keeps every Wikipedia-backed one', async () => {
    const elements = Array.from({ length: 80 }, (_, i) => ({
      type: 'node',
      id: i + 1,
      lat: CENTER.lat + (i + 1) * 0.00001,
      lon: CENTER.lng,
      tags: { name: `Statue ${i + 1}`, historic: 'monument' },
    }));
    const { provider } = makeProvider({ wikipedia: ok(istanbulWiki), overpass: ok({ elements }) });
    const result = await provider.findNearbyDetailed({ center: CENTER, radiusMeters: 400 });
    expect(result.landmarks.filter((l) => l.id.startsWith('osm:'))).toHaveLength(60);
    expect(result.landmarks.filter((l) => l.id.startsWith('wiki:')).length).toBeGreaterThanOrEqual(8);
  });
});
