import type { NarrationLength, TravelMode } from './options';

/** Assumed speaking pace, used to turn the brief's durations into word counts. */
export const SPOKEN_WORDS_PER_MINUTE = 150;

/**
 * Target narration length in words. Walking aims at ~60–90 s, driving at
 * ~30–60 s so the story ends before the place is behind the car.
 */
export const NARRATION_TARGET_WORDS: Record<TravelMode, Record<NarrationLength, number>> = {
  walking: { short: 130, medium: 190, long: 250 },
  driving: { short: 75, medium: 110, long: 150 },
};

export function targetWords(travelMode: TravelMode, length: NarrationLength): number {
  return NARRATION_TARGET_WORDS[travelMode][length];
}
