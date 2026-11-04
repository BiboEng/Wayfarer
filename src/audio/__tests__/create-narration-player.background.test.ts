import { createNarrationPlayer } from '../create-narration-player';
import type { PlaybackCallbacks, PlaybackOutput } from '../playback-output';
import type { BackgroundAwarePlayer, PlayableNarration } from '../types';

interface FakeOutput extends PlaybackOutput {
  kind: 'audio' | 'device-voice';
  callbacks: PlaybackCallbacks;
  pause: jest.Mock;
  resume: jest.Mock;
  stop: jest.Mock;
}

const AUDIO = { uri: 'https://api.example.test/a', headers: {} };
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup() {
  const outputs: FakeOutput[] = [];
  let appState: ((onScreen: boolean) => void) | null = null;
  const prepareAudio = jest.fn((_background: boolean) => Promise.resolve());
  const make = (kind: FakeOutput['kind'], callbacks: PlaybackCallbacks): FakeOutput => {
    const output: FakeOutput = { kind, callbacks, pause: jest.fn(), resume: jest.fn(), stop: jest.fn() };
    outputs.push(output);
    return output;
  };
  const player: BackgroundAwarePlayer = createNarrationPlayer({
    startAudioFile: (_s, callbacks) => make('audio', callbacks),
    startDeviceVoice: (_t, callbacks) => make('device-voice', callbacks),
    prepareAudio,
    subscribeAppState: (listener) => {
      appState = listener;
    },
  });
  return {
    player,
    outputs,
    prepareAudio,
    leave: () => appState?.(false),
    returnToApp: () => appState?.(true),
  };
}

const narration = (over: Partial<PlayableNarration> = {}): PlayableNarration => ({ id: 'n1', title: 'T', text: 'Story', audio: AUDIO, ...over });

async function playing(over: Partial<PlayableNarration> = {}) {
  const ctx = setup();
  ctx.player.play(narration(over));
  await flush();
  ctx.outputs[0].callbacks.onStarted();
  return ctx;
}

describe.each([
  ['audio file', {}],
  ['device voice', { audio: null }],
] as const)('background policy with %s', (_name, over) => {
  it('leaving the app pauses when background is not allowed (Explore)', async () => {
    const t = await playing(over);
    t.leave();
    expect(t.outputs[0].pause).toHaveBeenCalledTimes(1);
    expect(t.player.getState().status).toBe('paused');
  });

  it('leaving the app does nothing when background is allowed (Live Tour)', async () => {
    const t = await playing(over);
    t.player.setBackgroundAllowed(true);
    t.leave();
    expect(t.outputs[0].pause).not.toHaveBeenCalled();
    expect(t.player.getState().status).toBe('playing');
  });

  it('coming back does not resume by itself', async () => {
    const t = await playing(over);
    t.leave();
    t.returnToApp();
    expect(t.outputs[0].resume).not.toHaveBeenCalled();
    expect(t.player.getState().status).toBe('paused');
    t.player.resume();
    expect(t.outputs[0].resume).toHaveBeenCalledTimes(1);
    expect(t.player.getState().status).toBe('playing');
  });

  it('turning background off while off screen pauses what is playing', async () => {
    const t = await playing(over);
    t.player.setBackgroundAllowed(true);
    t.leave();
    t.player.setBackgroundAllowed(false);
    expect(t.outputs[0].pause).toHaveBeenCalledTimes(1);
    expect(t.player.getState().status).toBe('paused');
  });

  it('turning background off while on screen leaves the sound alone', async () => {
    const t = await playing(over);
    t.player.setBackgroundAllowed(true);
    t.player.setBackgroundAllowed(false);
    expect(t.outputs[0].pause).not.toHaveBeenCalled();
  });
});

describe('background policy edge cases', () => {
  it('a story that starts after the app already left the screen is paused when it starts', async () => {
    const t = setup();
    t.player.play(narration());
    t.leave();
    await flush();
    t.outputs[0].callbacks.onStarted();
    expect(t.outputs[0].pause).toHaveBeenCalledTimes(1);
    expect(t.player.getState().status).toBe('paused');
  });

  it('a story played while off screen and not allowed starts, then pauses', async () => {
    const t = setup();
    t.leave();
    t.player.play(narration());
    await flush();
    t.outputs[0].callbacks.onStarted();
    expect(t.player.getState().status).toBe('paused');
  });

  it('idle player: leaving does nothing', () => {
    const t = setup();
    t.leave();
    expect(t.player.getState().status).toBe('idle');
  });

  it('setBackgroundAllowed re-applies the audio mode only when the flag changes', () => {
    const t = setup();
    t.player.setBackgroundAllowed(false); // unchanged default
    expect(t.prepareAudio).not.toHaveBeenCalled();
    t.player.setBackgroundAllowed(true);
    t.player.setBackgroundAllowed(true);
    t.player.setBackgroundAllowed(false);
    expect(t.prepareAudio.mock.calls).toEqual([[true], [false]]);
  });

  it('play prepares the audio with the current flag', async () => {
    const t = setup();
    t.player.setBackgroundAllowed(true);
    t.prepareAudio.mockClear();
    t.player.play(narration());
    await flush();
    expect(t.prepareAudio).toHaveBeenCalledWith(true);
  });

  it('a failing prepareAudio in setBackgroundAllowed does not throw', async () => {
    const t = setup();
    t.prepareAudio.mockRejectedValueOnce(new Error('audio'));
    expect(() => t.player.setBackgroundAllowed(true)).not.toThrow();
    await flush();
  });

  it('works without an app-state subscription (always on screen)', async () => {
    const outputs: FakeOutput[] = [];
    const player = createNarrationPlayer({
      startAudioFile: (_s, callbacks) => {
        const o: FakeOutput = { kind: 'audio', callbacks, pause: jest.fn(), resume: jest.fn(), stop: jest.fn() };
        outputs.push(o);
        return o;
      },
      startDeviceVoice: jest.fn(),
      prepareAudio: () => Promise.resolve(),
    });
    player.play(narration());
    await flush();
    outputs[0].callbacks.onStarted();
    expect(player.getState().status).toBe('playing');
  });
});
