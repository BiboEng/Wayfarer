/**
 * Short orientation lines played right before a Live Tour story, in the same
 * voice. The text is fixed, so the server makes each one once per voice and
 * caches it for good.
 */
export const ORIENTATION_CUES = ['ahead', 'left', 'right'] as const;
export type OrientationCue = (typeof ORIENTATION_CUES)[number];

export const ORIENTATION_CUE_TEXT: Record<OrientationCue, string> = {
  ahead: 'Coming up ahead.',
  left: 'Coming up on your left.',
  right: 'Coming up on your right.',
};

export function isOrientationCue(value: unknown): value is OrientationCue {
  return (ORIENTATION_CUES as readonly unknown[]).includes(value);
}
