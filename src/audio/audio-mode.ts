/**
 * Configures the audio session before a narration plays, and again whenever background playback
 * is switched on (a Live Tour runs) or off.
 *
 * Background playback relies on the tour's location foreground service to keep the app alive.
 * No lock-screen media controls (`setActiveForLockScreen`): they need `interruptionMode:
 * 'doNotMix'`, which would pause the user's music instead of lowering it.
 */
import { setAudioModeAsync } from 'expo-audio';

import { devLog } from './dev-log';

let applied: { background: boolean; ready: Promise<void> } | null = null;

/** Never rejects. On failure, playback goes ahead with defaults and the next call tries again. */
export function prepareAudioMode(background = false): Promise<void> {
  if (applied?.background === background) return applied.ready;
  const entry = { background, ready: Promise.resolve() };
  entry.ready = setAudioModeAsync({
    playsInSilentMode: true,
    // Lower other apps (music) while narrating; on Android, calls pause us and nav prompts duck us.
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: background,
  }).catch((err: unknown) => {
    devLog('could not set the audio mode', String(err));
    if (applied === entry) applied = null;
  });
  applied = entry;
  return entry.ready;
}
