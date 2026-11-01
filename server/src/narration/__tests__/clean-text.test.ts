import { describe, expect, it } from 'vitest';
import { cleanNarration, splitSentences, stripFormatting } from '../clean-text';

const words = (n: number, sentenceLength = 10) =>
  Array.from({ length: Math.ceil(n / sentenceLength) }, (_, i) => `${'word '.repeat(sentenceLength - 1)}end${i}.`).join(' ');
const count = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe('stripFormatting', () => {
  it('removes headings, bold, italics, code marks and strikethrough', () => {
    expect(stripFormatting('# Title\n**Bold** and *italic* and _under_ and `code` and ~~gone~~')).toBe(
      'Title Bold and italic and under and code and gone',
    );
  });

  it('removes bullets and numbered lists but keeps the text', () => {
    expect(stripFormatting('- one\n* two\n+ three\n• four\n1. five\n2) six')).toBe('one two three four five six');
  });

  it('keeps link text and drops the url; same for images', () => {
    expect(stripFormatting('See [the tower](https://example.com/x) and ![alt text](https://img.example/a.png).')).toBe(
      'See the tower and alt text.',
    );
  });

  it('removes fenced code blocks entirely', () => {
    expect(stripFormatting('Before ```js\nconsole.log(1)\n``` after')).toBe('Before after');
  });

  it('removes block quote markers', () => {
    expect(stripFormatting('> quoted line\n> second')).toBe('quoted line second');
  });

  it('collapses whitespace and newlines to single spaces', () => {
    expect(stripFormatting('  a \n\n\n b\t\tc  ')).toBe('a b c');
  });

  it('leaves plain prose and hyphens inside words alone', () => {
    const text = 'The well-known tower, built in 1348, stands tall.';
    expect(stripFormatting(text)).toBe(text);
  });

  it('returns an empty string for blank input', () => {
    expect(stripFormatting('  \n ')).toBe('');
  });

  it('drops AD, A.D. and CE next to a year', () => {
    expect(stripFormatting('Built in AD 537, rebuilt in 1204 A.D. and 360 CE.')).toBe('Built in 537, rebuilt in 1204 and 360.');
  });

  it('leaves AD and CE alone when they are not next to a number', () => {
    const text = 'The AD of the museum met the CEO in CE Hall.';
    expect(stripFormatting(text)).toBe(text);
  });
});

describe('splitSentences', () => {
  it('splits at . ! and ?', () => {
    expect(splitSentences('One. Two! Three? Four')).toEqual(['One.', 'Two!', 'Three?', 'Four']);
  });

  it('keeps closing quotes with their sentence', () => {
    expect(splitSentences('He said "stop." Then left.')).toEqual(['He said "stop."', 'Then left.']);
  });

  it('returns [] for empty text', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('cleanNarration', () => {
  it('returns short text unchanged apart from formatting', () => {
    expect(cleanNarration('**A** short story.', 100)).toBe('A short story.');
  });

  it('keeps text up to 1.4 times the target', () => {
    const text = words(140);
    expect(cleanNarration(text, 100)).toBe(text);
  });

  it('cuts long text after the last sentence that still fits within 1.4 times the target', () => {
    const result = cleanNarration(words(300), 100);
    expect(count(result)).toBeLessThanOrEqual(140);
    expect(count(result)).toBeGreaterThan(100);
    expect(result.endsWith('.')).toBe(true);
  });

  it('never cuts in the middle of a sentence', () => {
    const result = cleanNarration(words(300, 7), 50);
    expect(result).toMatch(/end\d+\.$/);
  });

  it('keeps at least the first sentence even when it alone is over the limit', () => {
    const long = `${'word '.repeat(300)}end. Second sentence.`;
    const result = cleanNarration(long, 50);
    expect(result.startsWith('word')).toBe(true);
    expect(result).not.toContain('Second');
  });

  it('returns an empty string for empty or markdown-only input', () => {
    expect(cleanNarration('', 100)).toBe('');
    expect(cleanNarration('```code```', 100)).toBe('');
  });
});
