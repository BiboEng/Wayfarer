import { splitSentences, toSpeechChunks } from '../speech-chunks';

const words = (text: string) => text.split(/\s+/).filter(Boolean);

describe('splitSentences', () => {
  it('splits on . ! ?', () => {
    expect(splitSentences('It stood here. Was it old? Yes! Very old.')).toEqual(['It stood here.', 'Was it old?', 'Yes!', 'Very old.']);
  });

  it('returns nothing for empty or whitespace-only text', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   \n\t ')).toEqual([]);
  });

  it('returns one sentence when there is no terminator', () => {
    expect(splitSentences('No full stop here')).toEqual(['No full stop here']);
  });

  it('collapses whitespace and newlines', () => {
    expect(splitSentences('One.\n\n  Two.   Three.')).toEqual(['One.', 'Two.', 'Three.']);
  });

  describe('does not split after abbreviations', () => {
    it.each([
      ['Visit St. Paul\'s Cathedral today.', ['Visit St. Paul\'s Cathedral today.']],
      ['Dr. Smith designed it.', ['Dr. Smith designed it.']],
      ['It was built for Mr. Jones and Mrs. Jones.', ['It was built for Mr. Jones and Mrs. Jones.']],
      ['Prof. Higgins lived here.', ['Prof. Higgins lived here.']],
    ])('%s', (text, expected) => {
      expect(splitSentences(text)).toEqual(expected);
    });

    it('treats initials as part of a name', () => {
      expect(splitSentences('J. R. R. Tolkien wrote here. He loved it.')).toEqual(['J. R. R. Tolkien wrote here.', 'He loved it.']);
    });

    it('still splits after an abbreviation-like word that really ends a sentence in a normal case', () => {
      expect(splitSentences('The tower is tall. The bridge is long.')).toHaveLength(2);
    });
  });

  it('does not split decimals', () => {
    expect(splitSentences('The wall is 3.5 metres thick. It is old.')).toEqual(['The wall is 3.5 metres thick.', 'It is old.']);
  });

  it('keeps closing quotes with their sentence', () => {
    expect(splitSentences('He said "It is done." Then he left.')).toEqual(['He said "It is done."', 'Then he left.']);
  });

  it('does not split when the next word is lowercase', () => {
    expect(splitSentences('Built in c. 1250 by monks.')).toEqual(['Built in c. 1250 by monks.']);
  });

  it('never returns empty sentences', () => {
    expect(splitSentences('Hello.. ... World!!  ?')).not.toContain('');
  });
});

describe('toSpeechChunks', () => {
  const STORY =
    'The bridge opened in 1894. It is 3.5 metres wider than the old crossing! Dr. Smith, who lived nearby, walked it daily. ' +
    'Was it worth the cost? Visitors from St. Albans thought so. J. R. R. Tolkien never saw it.';

  it.each([30, 60, 100, 4000])('all chunks are non-empty and at most %i characters', (max) => {
    const chunks = toSpeechChunks(STORY, max);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
      expect(chunk.length).toBeLessThanOrEqual(max);
      expect(chunk).toBe(chunk.trim());
    }
  });

  it.each([30, 60, 100, 4000])('keeps every word in order (max %i)', (max) => {
    expect(words(toSpeechChunks(STORY, max).join(' '))).toEqual(words(STORY));
  });

  it('packs short sentences together in one chunk', () => {
    expect(toSpeechChunks('One. Two. Three.', 100)).toEqual(['One. Two. Three.']);
  });

  it('starts a new chunk when the next sentence would not fit', () => {
    expect(toSpeechChunks('Aaaa aaaa. Bbbb bbbb.', 15)).toEqual(['Aaaa aaaa.', 'Bbbb bbbb.']);
  });

  it('returns no chunks for empty text', () => {
    expect(toSpeechChunks('', 100)).toEqual([]);
    expect(toSpeechChunks('  \n ', 100)).toEqual([]);
  });

  it('splits one over-long sentence at a space', () => {
    const sentence = 'This single sentence just keeps going without any stop for quite a while longer than the limit allows';
    const chunks = toSpeechChunks(sentence, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(30);
    expect(words(chunks.join(' '))).toEqual(words(sentence));
    // Cut at spaces: every chunk is made of whole original words.
    const original = new Set(words(sentence));
    for (const chunk of chunks) for (const word of words(chunk)) expect(original.has(word)).toBe(true);
  });

  it('hard-cuts a single word longer than the limit and loses no characters', () => {
    const chunks = toSpeechChunks('Supercalifragilisticexpialidocious', 10);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(10);
    expect(chunks.join('')).toBe('Supercalifragilisticexpialidocious');
  });

  it('handles a non-finite limit as unlimited', () => {
    expect(toSpeechChunks('One. Two.', Infinity)).toEqual(['One. Two.']);
  });

  it('handles a limit below 1 without looping forever', () => {
    const chunks = toSpeechChunks('Hi there.', 0);
    expect(chunks.join('').replace(/\s/g, '')).toBe('Hithere.');
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(1);
  });
});
