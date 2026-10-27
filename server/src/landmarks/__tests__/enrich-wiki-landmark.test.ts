import { describe, expect, it, vi } from 'vitest';
import { wikiLandmark } from '../__fixtures__/builders';
import { enrichFromOsm } from '../enrich-wiki-landmark';
import type { OverpassClient } from '../overpass-client';

const signal = new AbortController().signal;

function client(byWikidata: OverpassClient['byWikidata']): OverpassClient {
  return {
    byWikidata,
    around: () => Promise.reject(new Error('unused')),
    byId: () => Promise.reject(new Error('unused')),
  };
}

const element = (tags: Record<string, string>) => ({
  elements: [{ type: 'node', id: 9, lat: 41.0, lon: 28.9, tags: { name: 'Ayasofya', ...tags } }],
});

describe('enrichFromOsm', () => {
  it('fills kind and osmTags from the OSM element with the same wikidata id', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q12506' });
    const byWikidata = vi.fn(() => Promise.resolve(element({ amenity: 'place_of_worship', religion: 'muslim', wikidata: 'Q12506' })));
    const result = await enrichFromOsm(landmark, client(byWikidata), signal);
    expect(byWikidata).toHaveBeenCalledWith('Q12506', signal);
    expect(result.kind).toBe('place_of_worship');
    expect(result.osmTags).toMatchObject({ amenity: 'place_of_worship', religion: 'muslim' });
  });

  it('keeps id, name, location, wikipedia and wikidata id from the Wikipedia landmark', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q12506' });
    const result = await enrichFromOsm(landmark, client(() => Promise.resolve(element({ tourism: 'museum' }))), signal);
    expect(result).toMatchObject({
      id: landmark.id,
      name: landmark.name,
      location: landmark.location,
      wikipedia: landmark.wikipedia,
      wikidataId: 'Q12506',
    });
  });

  it('keeps the existing kind when OSM classifies it as other', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q1', kind: 'monument' });
    const result = await enrichFromOsm(landmark, client(() => Promise.resolve(element({ note: 'x' }))), signal);
    expect(result.kind).toBe('monument');
  });

  it('keeps kind other when Overpass fails', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q12506' });
    const result = await enrichFromOsm(landmark, client(() => Promise.reject(new Error('502'))), signal);
    expect(result).toBe(landmark);
    expect(result.kind).toBe('other');
  });

  it('keeps the landmark when Overpass returns no element or garbage', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q12506' });
    expect(await enrichFromOsm(landmark, client(() => Promise.resolve({ elements: [] })), signal)).toBe(landmark);
    expect(await enrichFromOsm(landmark, client(() => Promise.resolve('junk')), signal)).toBe(landmark);
  });

  it('does not call Overpass without a wikidata id', async () => {
    const byWikidata = vi.fn(() => Promise.resolve(element({})));
    const landmark = wikiLandmark();
    expect(await enrichFromOsm(landmark, client(byWikidata), signal)).toBe(landmark);
    expect(byWikidata).not.toHaveBeenCalled();
  });

  it('lets existing osmTags win over fetched ones', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q1', osmTags: { historic: 'castle' } });
    const result = await enrichFromOsm(landmark, client(() => Promise.resolve(element({ historic: 'building', religion: 'x' }))), signal);
    expect(result.osmTags).toEqual({ historic: 'castle', religion: 'x' });
  });

  it('does not mutate the input landmark', async () => {
    const landmark = wikiLandmark({ wikidataId: 'Q1' });
    const before = JSON.stringify(landmark);
    await enrichFromOsm(landmark, client(() => Promise.resolve(element({ tourism: 'museum' }))), signal);
    expect(JSON.stringify(landmark)).toBe(before);
  });
});
