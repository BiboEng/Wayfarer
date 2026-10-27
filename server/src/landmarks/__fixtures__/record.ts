/**
 * Records real upstream responses as test fixtures. Run by hand, never in CI:
 *
 *   UPSTREAM_CONTACT=<email or url> npx tsx src/landmarks/__fixtures__/record.ts
 *
 * The contact is read from the environment (never hard-coded) and goes only
 * into the User-Agent header. Responses are trimmed to keep the files small.
 * Overpass is retried with backoff because the public instances are often busy.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LatLng } from '@shared/geo/lat-lng';
import { SERVER_VERSION } from '../../config/version';
import { buildUserAgent, createUpstreamHttp } from '../http';
import { buildAroundQuery } from '../overpass-client';
import { buildGeoSearchUrl } from '../wikipedia-client';

interface Spot {
  name: string;
  center: LatLng;
  radiusMeters: number;
}

const SPOTS: Spot[] = [
  { name: 'istanbul', center: { lat: 41.0086, lng: 28.9802 }, radiusMeters: 400 },
  { name: 'rural', center: { lat: 46.0, lng: 2.5 }, radiusMeters: 2000 },
  { name: 'ocean', center: { lat: 0, lng: -30 }, radiusMeters: 2000 },
];

const MAX_WIKI_PAGES = 8;
const MAX_OSM_ELEMENTS = 25;
const OVERPASS_ATTEMPTS = 6;
const OVERPASS_URLS = [
  process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const contact = process.env.UPSTREAM_CONTACT?.trim();
if (!contact) {
  console.error('Set UPSTREAM_CONTACT (an email address or a URL) before recording.');
  process.exit(1);
}
const userAgent = buildUserAgent(SERVER_VERSION, contact);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const outPath = (file: string) => fileURLToPath(new URL(file, import.meta.url));

function save(file: string, json: unknown): void {
  writeFileSync(outPath(file), JSON.stringify(json, null, 2) + '\n');
  console.log(`wrote ${file}`);
}

async function recordWikipedia(spot: Spot): Promise<void> {
  const http = createUpstreamHttp({ name: 'wikipedia', userAgent, timeoutMs: 15_000 });
  const json = (await http.getJson({ url: buildGeoSearchUrl(spot.center, spot.radiusMeters) })) as {
    query?: { pages?: unknown[] };
  };
  if (json.query?.pages) json.query.pages = json.query.pages.slice(0, MAX_WIKI_PAGES);
  save(`wikipedia-${spot.name}.json`, json);
}

async function recordOverpass(spot: Spot): Promise<boolean> {
  const body = `data=${encodeURIComponent(buildAroundQuery(spot.center, spot.radiusMeters))}`;
  for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt++) {
    for (const url of OVERPASS_URLS) {
      const http = createUpstreamHttp({ name: 'overpass', userAgent, timeoutMs: 30_000, retryDelayMs: 2_000 });
      try {
        const json = (await http.getJson({ url, method: 'POST', body })) as { elements?: unknown[]; remark?: string };
        if (!Array.isArray(json.elements) || json.remark?.includes('runtime error')) throw new Error('incomplete');
        json.elements = json.elements.slice(0, MAX_OSM_ELEMENTS);
        save(`overpass-${spot.name}.json`, json);
        return true;
      } catch (error) {
        console.warn(`overpass ${spot.name} attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'error'}`);
      }
    }
    await wait(5_000 * 2 ** attempt);
  }
  return false;
}

// Wikipedia first (fast and reliable), then the slower and flakier Overpass.
for (const spot of SPOTS) await recordWikipedia(spot);
for (const spot of SPOTS) {
  if (!(await recordOverpass(spot))) console.error(`Could not record Overpass for ${spot.name}.`);
}
