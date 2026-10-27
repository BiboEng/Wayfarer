import type { Landmark } from '@shared/landmarks/landmark';
import { WIKIPEDIA_EXTRACT_MAX_CHARS } from '@shared/landmarks/search';
import { asFiniteNumber, asString, asWikidataId, isRecord, type JsonRecord } from './json-guards';

const ARTICLE_BASE_URL = 'https://en.wikipedia.org/wiki/';

/** Cuts the extract to the cap, preferably at a sentence or word boundary. */
export function truncateExtract(text: string, maxChars: number = WIKIPEDIA_EXTRACT_MAX_CHARS): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  if (sentenceEnd > maxChars * 0.5) return cut.slice(0, sentenceEnd + 1);
  const wordEnd = cut.lastIndexOf(' ');
  return (wordEnd > maxChars * 0.5 ? cut.slice(0, wordEnd) : cut).trimEnd();
}

function articleUrl(title: string): string {
  return ARTICLE_BASE_URL + encodeURIComponent(title.replace(/ /g, '_'));
}

function pageToLandmark(page: JsonRecord): Landmark | null {
  const pageId = asFiniteNumber(page.pageid);
  const title = asString(page.title);
  if (pageId === undefined || title === undefined || page.missing === true) return null;

  const coordinates = Array.isArray(page.coordinates) ? page.coordinates[0] : undefined;
  if (!isRecord(coordinates)) return null;
  const lat = asFiniteNumber(coordinates.lat);
  const lng = asFiniteNumber(coordinates.lon);
  if (lat === undefined || lng === undefined) return null;

  const props = isRecord(page.pageprops) ? page.pageprops : {};
  if ('disambiguation' in props) return null;

  const thumbnail = isRecord(page.thumbnail) ? asString(page.thumbnail.source) : undefined;
  const wikidataId = asWikidataId(props.wikibase_item);

  return {
    id: `wiki:${pageId}`,
    name: title,
    location: { lat, lng },
    kind: 'other',
    ...(wikidataId ? { wikidataId } : {}),
    wikipedia: {
      pageId,
      title,
      url: asString(page.fullurl) ?? articleUrl(title),
      extract: truncateExtract(asString(page.extract) ?? ''),
      ...(thumbnail ? { thumbnailUrl: thumbnail } : {}),
    },
  };
}

/** Pure: MediaWiki `action=query` JSON (formatversion=2) to landmarks. Order is not guaranteed. */
export function parseWikipediaPages(json: unknown): Landmark[] {
  if (!isRecord(json) || !isRecord(json.query)) return [];
  const pages = json.query.pages;
  const list: unknown[] = Array.isArray(pages) ? pages : isRecord(pages) ? Object.values(pages) : [];
  const landmarks: Landmark[] = [];
  for (const page of list) {
    if (!isRecord(page)) continue;
    const landmark = pageToLandmark(page);
    if (landmark) landmarks.push(landmark);
  }
  return landmarks;
}
