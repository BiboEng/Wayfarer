import { createNarrationPlayer } from '../create-narration-player';
import type { PlaybackCallbacks, PlaybackOutput } from '../playback-output';
import type { NarrationPlayer, PlayableNarration, RemoteSound } from '../types';

export interface FakeOutput extends PlaybackOutput {
  kind: 'audio' | 'device-voice';
  callbacks: PlaybackCallbacks;
  stopped: boolean;
  pause: jest.Mock;
  resume: jest.Mock;
  stop: jest.Mock;
  /** The uri (audio) or the text spoken (device voice). */
  arg: string;
}

export const MAIN_AUDIO: RemoteSound = { uri: 'https://api.example.test/narrations/audio/main', headers: { 'x-wayfarer-token': 'tok' } };
export const INTRO_AUDIO: RemoteSound = { uri: 'https://api.example.test/narrations/audio/cue-left', headers: { 'x-wayfarer-token': 'tok' } };

/** A player wired to fake outputs that record what was started, in order. */
export function setupPlayer() {
  const outputs: FakeOutput[] = [];
  const events: string[] = [];

  const make = (kind: FakeOutput['kind'], arg: string, callbacks: PlaybackCallbacks): FakeOutput => {
    const output: FakeOutput = {
      kind,
      arg,
      callbacks,
      stopped: false,
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn(() => {
        output.stopped = true;
        events.push(`stop:${kind}:${arg}`);
      }),
    };
    events.push(`start:${kind}:${arg}`);
    outputs.push(output);
    return output;
  };

  const player: NarrationPlayer = createNarrationPlayer({
    startAudioFile: (source, callbacks) => make('audio', source.uri, callbacks),
    startDeviceVoice: (text, callbacks) => make('device-voice', text, callbacks),
    prepareAudio: () => Promise.resolve(),
  });

  const statuses: string[] = [];
  player.subscribe(() => statuses.push(player.getState().status));

  return { player, outputs, events, statuses };
}

/** Lets the awaited prepareAudio() resolve so the output starts. */
export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

export const narration = (over: Partial<PlayableNarration> = {}): PlayableNarration => ({
  id: 'n1',
  title: 'Test Bridge',
  text: 'A story about the bridge.',
  audio: MAIN_AUDIO,
  intro: { text: 'Coming up on your left.', audio: INTRO_AUDIO },
  ...over,
});
