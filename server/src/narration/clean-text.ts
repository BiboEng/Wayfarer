/** A story may run this much over the target before it is cut at a sentence boundary. */
const MAX_OVERRUN = 1.4;

/** Pure: removes markdown, lists and stray formatting, then collapses whitespace. */
export function stripFormatting(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, '') // bullets and numbered lists
    .replace(/^\s*>\s?/gm, '') // quotes
    .replace(/(\*\*|__|\*|_|`|~~)/g, '') // emphasis and code marks
    .replace(/\b(?:AD|A\.D\.|CE)\s+(?=\d)|(?<=\d)\s+(?:AD\b|A\.D\.|CE\b)/g, '') // era marks the voice spells out
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text === '' ? 0 : text.split(/\s+/).length;
}

/** Splits at ". ", "! " or "? " (optionally followed by a closing quote). */
export function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+(?:[.!?]+["'”’)]*|$)/g)?.map((s) => s.trim()).filter((s) => s !== '') ?? [];
}

/**
 * Pure: cleans a model reply for speech. If it is far longer than the target,
 * cuts it after the last sentence that still fits.
 */
export function cleanNarration(raw: string, targetWords: number): string {
  let text = stripFormatting(raw);
  const limit = Math.ceil(targetWords * MAX_OVERRUN);
  if (countWords(text) <= limit) return text;

  const kept: string[] = [];
  let words = 0;
  for (const sentence of splitSentences(text)) {
    const n = countWords(sentence);
    if (kept.length > 0 && words + n > limit) break;
    kept.push(sentence);
    words += n;
  }
  text = kept.join(' ');
  return text;
}
