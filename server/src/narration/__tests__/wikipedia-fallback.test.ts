import { describe, expect, it } from 'vitest';
import { WIKIPEDIA_EXTRACT_MAX_CHARS } from '@shared/landmarks/search';
import { parseWikipediaPages } from '../../landmarks/parse-wikipedia';
import istanbul from '../../landmarks/__fixtures__/wikipedia-istanbul.json';
import { wikipediaFallbackText } from '../wikipedia-fallback';

const count = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe('wikipediaFallbackText', () => {
  it('returns the whole extract when it is shorter than the target', () => {
    expect(wikipediaFallbackText('One short sentence. And another.', 100)).toBe('One short sentence. And another.');
  });

  it('takes whole sentences up to about the target', () => {
    const extract = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} has six words.`).join(' ');
    const result = wikipediaFallbackText(extract, 40);
    expect(result.endsWith('.')).toBe(true);
    expect(count(result)).toBeLessThanOrEqual(40);
    expect(count(result)).toBeGreaterThan(25);
    expect(result.startsWith('Sentence number 0')).toBe(true);
  });

  it('always keeps the first sentence, even if it is longer than the target', () => {
    const first = `${'long '.repeat(80)}ends.`;
    const result = wikipediaFallbackText(`${first} Second.`, 20);
    expect(result).toBe(first);
  });

  it('removes parenthetical asides such as pronunciations', () => {
    const extract = 'Hagia Sophia (UK: , US: ; Greek: Agia Sophia) is a mosque (formerly a church). It is old.';
    expect(wikipediaFallbackText(extract, 100)).toBe('Hagia Sophia is a mosque. It is old.');
  });

  it('removes nested-free brackets and citation marks', () => {
    expect(wikipediaFallbackText('It stands tall[1] and wide[citation needed].', 100)).toBe('It stands tall and wide.');
  });

  it('collapses whitespace and newlines', () => {
    expect(wikipediaFallbackText('A  first\n\nsentence.   B second.', 100)).toBe('A first sentence. B second.');
  });

  it('returns an empty string for an empty extract', () => {
    expect(wikipediaFallbackText('', 100)).toBe('');
    expect(wikipediaFallbackText('   ', 100)).toBe('');
  });

  it('works on the recorded Hagia Sophia extract and stays short and clean', () => {
    const hagia = parseWikipediaPages(istanbul).find((l) => l.name === 'Hagia Sophia');
    const result = wikipediaFallbackText(hagia?.wikipedia?.extract ?? '', 130);
    expect(result.length).toBeGreaterThan(50);
    expect(result.length).toBeLessThanOrEqual(WIKIPEDIA_EXTRACT_MAX_CHARS);
    expect(count(result)).toBeLessThanOrEqual(130 + 60); // a long first sentence may overshoot
    expect(result).not.toMatch(/\(\s*\)/);
    expect(result).not.toMatch(/\[\d+\]/);
    expect(result.endsWith('.')).toBe(true);
  });
});
