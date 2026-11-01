/** The app-wide narration player: one sound at a time, shared by Explore and Live Tour. */
import { startAudioFile } from './audio-file-output';
import { prepareAudioMode } from './audio-mode';
import { createNarrationPlayer } from './create-narration-player';
import { startDeviceVoice } from './device-voice-output';

export const narrationPlayer = createNarrationPlayer({
  startAudioFile,
  startDeviceVoice,
  prepareAudio: prepareAudioMode,
});
