export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Wikidata item ids look like "Q12506"; anything else is dropped. */
export function asWikidataId(value: unknown): string | undefined {
  return typeof value === 'string' && /^Q\d+$/.test(value) ? value : undefined;
}
