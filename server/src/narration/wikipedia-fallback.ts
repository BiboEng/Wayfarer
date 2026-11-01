import { splitSentences } from './clean-text';

function countWords(text: string): number {
  return text === '' ? 0 : text.split(/\s+/).length;
}

/**
 * Pure: the first sentences of a Wikipedia intro, trimmed to about the target
 * length. Free and factual; used when the AI step is unavailable.
 * Parenthetical asides (pronunciations, dates in brackets) are removed because they read badly aloud.
 */
export function wikipediaFallbackText(extract: string, targetWords: number): string {
  const plain = extract
    .replace(/\s*\([^()]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const kept: string[] = [];
  let words = 0;
  for (const sentence of splitSentences(plain)) {
    const n = countWords(sentence);
    if (kept.length > 0 && words + n > targetWords) break;
    kept.push(sentence);
    words += n;
    if (words >= targetWords) break;
  }
  return kept.join(' ');
}
