/** Configures the audio session once, before the first narration plays. */
import { setAudioModeAsync } from 'expo-audio';

import { devLog } from './dev-log';

let ready: Promise<void> | null = null;

/** Never rejects. On failure, playback goes ahead with defaults and the next call tries again. */
export function prepareAudioMode(): Promise<void> {
  ready ??= setAudioModeAsync({
    playsInSilentMode: true,
    // Lower other apps (music) while narrating; on Android, calls pause us and nav prompts duck us.
    interruptionMode: 'duckOthers',
    // Background playback comes in Phase 6 (needs lock-screen controls on Android).
    shouldPlayInBackground: false,
  }).catch((err: unknown) => {
    devLog('could not set the audio mode', String(err));
    ready = null;
  });
  return ready;
}
