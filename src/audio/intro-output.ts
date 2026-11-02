/** Which output plays a narration's intro, if any. Pure: no React or Expo imports. */
import type { PlayableNarration, PlayerOutput } from './types';

/**
 * Main part with audio: the intro plays only from its own audio (null = no intro).
 * Main part on the device voice: the device speaks the intro text too.
 */
export function introOutputFor(narration: PlayableNarration): PlayerOutput | null {
  const { intro } = narration;
  if (!intro) return null;
  if (narration.audio) return intro.audio ? 'audio' : null;
  return intro.text.trim() ? 'device-voice' : null;
}
