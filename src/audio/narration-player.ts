/** The app-wide narration player: one sound at a time, shared by Explore and Live Tour. */
import { AppState } from 'react-native';

import { startAudioFile } from './audio-file-output';
import { prepareAudioMode } from './audio-mode';
import { createNarrationPlayer } from './create-narration-player';
import { startDeviceVoice } from './device-voice-output';

export const narrationPlayer = createNarrationPlayer({
  startAudioFile,
  startDeviceVoice,
  prepareAudio: prepareAudioMode,
  // Lives as long as the app, so the subscription is never removed. Only 'background' counts as
  // off screen (iOS 'inactive' is a pulled-down control centre, not leaving the app).
  subscribeAppState: (listener) => {
    AppState.addEventListener('change', (state) => {
      if (state === 'background') listener(false);
      else if (state === 'active') listener(true);
    });
  },
});
