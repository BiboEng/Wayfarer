/**
 * Splits narration text into chunks the device voice can speak one after another.
 * Pure: no React or Expo imports.
 */

/** Words that end with a period but don't end a sentence (lowercase, without the final period). */
const ABBREVIATIONS = new Set([
  'st', 'dr', 'mr', 'mrs', 'ms', 'prof', 'rev', 'fr', 'sr', 'jr', 'gen', 'col', 'capt', 'lt', 'sgt',
  'mt', 'ft', 'ave', 'rd', 'sq', 'no', 'vs', 'etc', 'approx', 'ca', 'c', 'e.g', 'i.e', 'cf', 'al',
]);

/** Sentence end: terminators, optional closing quotes/brackets, then whitespace. */
const BOUNDARY = /[.!?…]+["'”’)\]]*\s+/g;

/** Splits text into sentences. Whitespace is collapsed; no empty sentences. */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences: string[] = [];
  let start = 0;
  for (const match of clean.matchAll(BOUNDARY)) {
    const end = match.index + match[0].length;
    if (!isSentenceEnd(clean, match.index, match[0], end)) continue;
    sentences.push(clean.slice(start, end).trim());
    start = end;
  }
  const rest = clean.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

function isSentenceEnd(text: string, at: number, terminator: string, next: number): boolean {
  // The next sentence starts with a capital, digit or quote; a lowercase word means we're mid-sentence.
  const following = text.charAt(next);
  if (following && following !== following.toUpperCase()) return false;

  if (!terminator.startsWith('.') || terminator.startsWith('..')) return true;
  const word = (/(\S+)$/.exec(text.slice(0, at))?.[1] ?? '').replace(/^["'“‘([]+/, '');
  if (ABBREVIATIONS.has(word.toLowerCase())) return false;
  // A single capital letter is an initial ("J. R. R. Tolkien").
  return !/^[A-Z]$/.test(word);
}

/**
 * Packs sentences into chunks no longer than `maxLength` characters. A sentence longer than
 * that is split at spaces (or hard-cut if a single word is too long). Never returns empty chunks.
 */
export function toSpeechChunks(text: string, maxLength: number): string[] {
  const max = Number.isFinite(maxLength) ? Math.max(1, Math.floor(maxLength)) : Number.MAX_SAFE_INTEGER;
  const chunks: string[] = [];
  let current = '';

  for (const sentence of splitSentences(text)) {
    for (const piece of splitLong(sentence, max)) {
      if (!current) current = piece;
      else if (current.length + 1 + piece.length <= max) current = `${current} ${piece}`;
      else {
        chunks.push(current);
        current = piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Splits one sentence into pieces of at most `max` characters, at spaces where possible. */
function splitLong(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];

  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const space = rest.lastIndexOf(' ', max);
    const cut = space > 0 ? space : max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces.filter((piece) => piece.length > 0);
}
