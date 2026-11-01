// Generates src/components/map/country-labels.data.ts from Natural Earth.
//
// Usage (from the repo root):
//   node scripts/country-labels/generate.mjs <path-to-ne_50m_admin_0_countries.geojson>
//
// Download the GeoJSON (public domain) outside the repo, e.g.:
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//
// The app draws its own country names because Google's map labels cannot be
// renamed one by one. The Google country labels are hidden in src/theme/map-style.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// OVERRIDES: the app's own naming decisions. Edit here, then regenerate.
// ---------------------------------------------------------------------------

// Natural Earth entries removed before anything else, by their NAME.
// "Palestine" is dropped because the area gets exactly one label (see RENAME):
// otherwise two labels would be drawn a few kilometres apart.
const DROP = ['Palestine'];

// Natural Earth NAME -> the name the app shows. The entry keeps its own label
// point and zoom range. "Israel" becomes "Palestine", so the whole area carries
// the single label "Palestine", at the point Natural Earth used for "Israel".
const RENAME = { Israel: 'Palestine' };

// ---------------------------------------------------------------------------

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/components/map/country-labels.data.ts');
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/country-labels/generate.mjs <ne_50m_admin_0_countries.geojson>');
  process.exit(1);
}

const round3 = (value) => Math.round(value * 1000) / 1000;

const collection = JSON.parse(readFileSync(inputPath, 'utf8'));
let labels = collection.features.map(({ properties: p }) => {
  for (const key of ['NAME', 'LABEL_X', 'LABEL_Y', 'MIN_LABEL', 'MAX_LABEL']) {
    if (p[key] === undefined || p[key] === null) throw new Error(`Missing ${key} on ${JSON.stringify(p.NAME)}`);
  }
  return {
    name: p.NAME,
    lat: round3(p.LABEL_Y),
    lng: round3(p.LABEL_X),
    minZoom: p.MIN_LABEL,
    maxZoom: p.MAX_LABEL,
  };
});

// Fail loudly if Natural Earth ever renames an entry we override.
for (const name of [...DROP, ...Object.keys(RENAME)]) {
  if (!labels.some((label) => label.name === name)) throw new Error(`Override target not found: ${name}`);
}
labels = labels.filter((label) => !DROP.includes(label.name));
labels = labels.map((label) => ({ ...label, name: RENAME[label.name] ?? label.name }));

const names = labels.map((label) => label.name);
if (new Set(names).size !== names.length) throw new Error('Duplicate label names after overrides');

// Most prominent first, so a cap on the number of labels keeps the important ones.
labels.sort((a, b) => a.minZoom - b.minZoom || a.name.localeCompare(b.name));

const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const rows = labels.map(
  (l) => `  { name: ${quote(l.name)}, lat: ${l.lat}, lng: ${l.lng}, minZoom: ${l.minZoom}, maxZoom: ${l.maxZoom} },`,
);

const output = `// GENERATED FILE - do not edit by hand.
// Source: Natural Earth 1:50m Admin 0 - Countries (public domain), properties
// NAME, LABEL_Y, LABEL_X, MIN_LABEL, MAX_LABEL.
//   ${SOURCE_URL}
// Naming overrides (e.g. the Israel entry shown as "Palestine") live at the top of the generator.
// Regenerate: node scripts/country-labels/generate.mjs <path-to-ne_50m_admin_0_countries.geojson>

import type { CountryLabel } from './visible-labels';

export const COUNTRY_LABELS: readonly CountryLabel[] = [
${rows.join('\n')}
];
`;

writeFileSync(OUTPUT, output);
console.log(`Wrote ${labels.length} labels to ${OUTPUT}`);
