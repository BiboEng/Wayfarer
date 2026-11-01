import { NARRATION_TARGET_WORDS, SPOKEN_WORDS_PER_MINUTE, targetWords } from '../length';
import { NARRATION_LENGTHS, TRAVEL_MODES } from '../options';

describe('targetWords', () => {
  it.each(TRAVEL_MODES.flatMap((mode) => NARRATION_LENGTHS.map((length) => [mode, length] as const)))(
    '%s / %s matches the table',
    (mode, length) => {
      expect(targetWords(mode, length)).toBe(NARRATION_TARGET_WORDS[mode][length]);
    },
  );

  it('grows with the length for each mode', () => {
    for (const mode of TRAVEL_MODES) {
      const { short, medium, long } = NARRATION_TARGET_WORDS[mode];
      expect(short).toBeLessThan(medium);
      expect(medium).toBeLessThan(long);
    }
  });

  it('driving is always shorter than walking at the same length', () => {
    for (const length of NARRATION_LENGTHS) {
      expect(NARRATION_TARGET_WORDS.driving[length]).toBeLessThan(NARRATION_TARGET_WORDS.walking[length]);
    }
  });

  it('walking stays in the brief\'s 60-90 s range for short and medium, driving in 30-60 s', () => {
    const seconds = (words: number) => (words / SPOKEN_WORDS_PER_MINUTE) * 60;
    expect(seconds(targetWords('walking', 'medium'))).toBeGreaterThanOrEqual(60);
    expect(seconds(targetWords('walking', 'medium'))).toBeLessThanOrEqual(90);
    expect(seconds(targetWords('driving', 'short'))).toBeGreaterThanOrEqual(30);
    expect(seconds(targetWords('driving', 'medium'))).toBeLessThanOrEqual(60);
  });

  it('is exhaustive over every mode and length', () => {
    expect(Object.keys(NARRATION_TARGET_WORDS).sort()).toEqual([...TRAVEL_MODES].sort());
    for (const mode of TRAVEL_MODES) {
      expect(Object.keys(NARRATION_TARGET_WORDS[mode]).sort()).toEqual([...NARRATION_LENGTHS].sort());
    }
  });
});
