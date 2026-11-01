import { createNarrationPlayer } from '../create-narration-player';
import type { PlaybackCallbacks, PlaybackOutput } from '../playback-output';
import type { NarrationPlayer, PlayableNarration } from '../types';

interface FakeOutput extends PlaybackOutput {
  kind: 'audio' | 'device-voice';
  callbacks: PlaybackCallbacks;
  stopped: boolean;
  paused: boolean;
  pause: jest.Mock;
  resume: jest.Mock;
  stop: jest.Mock;
  /** Text spoken (device voice) or uri (audio). */
  arg: string;
}

const AUDIO = { uri: 'https://api.example.test/narrations/audio/a', headers: { 'x-wayfarer-token': 'tok' } };

function setup() {
  const outputs: FakeOutput[] = [];
  const events: string[] = [];

  const make = (kind: FakeOutput['kind'], arg: string, callbacks: PlaybackCallbacks): FakeOutput => {
    const output: FakeOutput = {
      kind,
      arg,
      callbacks,
      stopped: false,
      paused: false,
      pause: jest.fn(() => {
        output.paused = true;
      }),
      resume: jest.fn(() => {
        output.paused = false;
      }),
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
  return { player, outputs, events };
}

/** Lets the awaited prepareAudio() resolve so the output starts. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const narration = (over: Partial<PlayableNarration> = {}): PlayableNarration => ({
  id: 'n1',
  title: 'Test Bridge',
  text: 'A story about the bridge.',
  audio: AUDIO,
  ...over,
});

async function playing(over: Partial<PlayableNarration> = {}) {
  const ctx = setup();
  ctx.player.play(narration(over));
  await flush();
  ctx.outputs[0].callbacks.onStarted();
  return ctx;
}

describe('createNarrationPlayer', () => {
  it('starts idle with no narration id', () => {
    const { player } = setup();
    expect(player.getState()).toEqual({ status: 'idle', narrationId: null, output: null });
  });

  describe('play', () => {
    it('is loading right away, then playing once the output starts', async () => {
      const { player, outputs } = setup();
      player.play(narration());
      expect(player.getState()).toEqual({ status: 'loading', narrationId: 'n1', output: 'audio' });
      await flush();
      expect(outputs).toHaveLength(1);
      outputs[0].callbacks.onStarted();
      expect(player.getState()).toEqual({ status: 'playing', narrationId: 'n1', output: 'audio' });
    });

    it('uses the audio file when there is audio', async () => {
      const { outputs, player } = setup();
      player.play(narration());
      await flush();
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([['audio', AUDIO.uri]]);
    });

    it('uses the device voice directly when audio is null', async () => {
      const { outputs, player } = setup();
      player.play(narration({ audio: null }));
      expect(player.getState().output).toBe('device-voice');
      await flush();
      expect(outputs.map((o) => [o.kind, o.arg])).toEqual([['device-voice', 'A story about the bridge.']]);
    });

    it('still starts when prepareAudio rejects', async () => {
      const outputs: string[] = [];
      const player = createNarrationPlayer({
        startAudioFile: (source) => {
          outputs.push(source.uri);
          return { pause: jest.fn(), resume: jest.fn(), stop: jest.fn() };
        },
        startDeviceVoice: () => ({ pause: jest.fn(), resume: jest.fn(), stop: jest.fn() }),
        prepareAudio: () => Promise.reject(new Error('no audio session')),
      });
      player.play(narration());
      await flush();
      expect(outputs).toEqual([AUDIO.uri]);
    });

    it('plays to the end -> ended', async () => {
      const { player, outputs } = await playing();
      outputs[0].callbacks.onFinished();
      expect(player.getState()).toEqual({ status: 'ended', narrationId: 'n1', output: 'audio' });
    });

    it('while playing: stops the first output before starting the second (never two active)', async () => {
      const { player, outputs, events } = await playing();
      player.play(narration({ id: 'n2', audio: { ...AUDIO, uri: 'https://api.example.test/narrations/audio/b' } }));
      await flush();

      expect(outputs).toHaveLength(2);
      expect(outputs[0].stopped).toBe(true);
      expect(events).toEqual([
        `start:audio:${AUDIO.uri}`,
        `stop:audio:${AUDIO.uri}`,
        'start:audio:https://api.example.test/narrations/audio/b',
      ]);
      expect(player.getState().narrationId).toBe('n2');
    });

    it('stops the first output immediately, even before the second has started', async () => {
      const { player, outputs } = await playing();
      player.play(narration({ id: 'n2' }));
      expect(outputs[0].stopped).toBe(true);
      expect(outputs).toHaveLength(1);
    });

    it('two plays in a row before the audio session is ready start only the last output', async () => {
      const { player, outputs } = setup();
      player.play(narration({ id: 'a' }));
      player.play(narration({ id: 'b', audio: null, text: 'Second.' }));
      await flush();
      expect(outputs.map((o) => o.arg)).toEqual(['Second.']);
      expect(player.getState().narrationId).toBe('b');
    });

    it('callbacks from the stopped (first) output do not change the new state', async () => {
      const { player, outputs } = await playing();
      const first = outputs[0];
      player.play(narration({ id: 'n2', audio: null, text: 'Second.' }));
      await flush();
      const before = player.getState();

      first.callbacks.onFinished();
      first.callbacks.onError();
      first.callbacks.onInterrupted(true);
      first.callbacks.onStarted();

      expect(player.getState()).toEqual(before);
      expect(outputs).toHaveLength(2); // the late error did not start a fallback
    });
  });

  describe('audio failure', () => {
    it('falls back to the device voice with the same text', async () => {
      const { player, outputs } = await playing();
      outputs[0].callbacks.onError();
      expect(outputs[0].stopped).toBe(true);
      expect(player.getState()).toEqual({ status: 'loading', narrationId: 'n1', output: 'device-voice' });
      expect(outputs).toHaveLength(2);
      expect(outputs[1].kind).toBe('device-voice');
      expect(outputs[1].arg).toBe('A story about the bridge.');
      outputs[1].callbacks.onStarted();
      expect(player.getState()).toEqual({ status: 'playing', narrationId: 'n1', output: 'device-voice' });
    });

    it('falls back when the audio fails while still loading', async () => {
      const { player, outputs } = setup();
      player.play(narration());
      await flush();
      outputs[0].callbacks.onError();
      expect(outputs[1]).toMatchObject({ kind: 'device-voice', arg: 'A story about the bridge.' });
      expect(player.getState().output).toBe('device-voice');
    });

    it('never has two active outputs during the fallback', async () => {
      const { outputs, events } = await playing();
      outputs[0].callbacks.onError();
      expect(events.indexOf(`stop:audio:${AUDIO.uri}`)).toBeLessThan(events.indexOf('start:device-voice:A story about the bridge.'));
    });

    it('a second error from the failed audio is ignored', async () => {
      const { player, outputs } = await playing();
      const audio = outputs[0];
      audio.callbacks.onError();
      audio.callbacks.onError();
      expect(outputs).toHaveLength(2);
      expect(player.getState().status).toBe('loading');
    });

    it('the device voice finishing after a fallback -> ended', async () => {
      const { player, outputs } = await playing();
      outputs[0].callbacks.onError();
      outputs[1].callbacks.onStarted();
      outputs[1].callbacks.onFinished();
      expect(player.getState()).toEqual({ status: 'ended', narrationId: 'n1', output: 'device-voice' });
    });
  });

  describe('device voice failure', () => {
    it('-> failed (no further fallback)', async () => {
      const { player, outputs } = await playing({ audio: null });
      outputs[0].callbacks.onError();
      expect(player.getState()).toEqual({ status: 'failed', narrationId: 'n1', output: 'device-voice' });
      expect(outputs).toHaveLength(1);
      expect(outputs[0].stopped).toBe(true);
    });

    it('fallback voice failing too -> failed', async () => {
      const { player, outputs } = await playing();
      outputs[0].callbacks.onError();
      outputs[1].callbacks.onError();
      expect(player.getState().status).toBe('failed');
      expect(outputs).toHaveLength(2);
    });
  });

  describe('pause / resume', () => {
    it('pause then resume while playing', async () => {
      const { player, outputs } = await playing();
      player.pause();
      expect(outputs[0].pause).toHaveBeenCalledTimes(1);
      expect(player.getState().status).toBe('paused');
      player.resume();
      expect(outputs[0].resume).toHaveBeenCalledTimes(1);
      expect(player.getState().status).toBe('playing');
    });

    it('system interruption pauses and resumes the state', async () => {
      const { player, outputs } = await playing();
      outputs[0].callbacks.onInterrupted(true);
      expect(player.getState().status).toBe('paused');
      outputs[0].callbacks.onInterrupted(false);
      expect(player.getState().status).toBe('playing');
    });

    it('pause is a no-op when idle, loading, ended or failed', async () => {
      const idle = setup();
      idle.player.pause();
      expect(idle.player.getState().status).toBe('idle');

      const loading = setup();
      loading.player.play(narration());
      loading.player.pause();
      await flush();
      expect(loading.player.getState().status).toBe('loading');
      expect(loading.outputs[0].pause).not.toHaveBeenCalled();

      const ended = await playing();
      ended.outputs[0].callbacks.onFinished();
      ended.player.pause();
      expect(ended.player.getState().status).toBe('ended');
      expect(ended.outputs[0].pause).not.toHaveBeenCalled();

      const failed = await playing({ audio: null });
      failed.outputs[0].callbacks.onError();
      failed.player.pause();
      expect(failed.player.getState().status).toBe('failed');
    });

    it('resume is a no-op when not paused', async () => {
      const idle = setup();
      idle.player.resume();
      expect(idle.player.getState().status).toBe('idle');

      const ctx = await playing();
      ctx.player.resume();
      expect(ctx.outputs[0].resume).not.toHaveBeenCalled();
      expect(ctx.player.getState().status).toBe('playing');

      ctx.outputs[0].callbacks.onFinished();
      ctx.player.resume();
      expect(ctx.player.getState().status).toBe('ended');
      expect(ctx.outputs[0].resume).not.toHaveBeenCalled();
    });

    it('resume after the audio failed while paused starts the device voice', async () => {
      const { player, outputs } = await playing();
      player.pause();
      outputs[0].callbacks.onError();
      // Paused: the fallback waits for the user.
      expect(player.getState()).toEqual({ status: 'paused', narrationId: 'n1', output: 'device-voice' });
      expect(outputs).toHaveLength(1);

      player.resume();
      expect(outputs).toHaveLength(2);
      expect(outputs[1]).toMatchObject({ kind: 'device-voice', arg: 'A story about the bridge.' });
      expect(player.getState().status).toBe('playing');
    });
  });

  describe('stop', () => {
    it('stops the output and goes idle with a null narration id', async () => {
      const { player, outputs } = await playing();
      player.stop();
      expect(outputs[0].stopped).toBe(true);
      expect(player.getState()).toEqual({ status: 'idle', narrationId: null, output: null });
    });

    it('late callbacks after stop change nothing and start no fallback', async () => {
      const { player, outputs } = await playing();
      player.stop();
      outputs[0].callbacks.onError();
      outputs[0].callbacks.onFinished();
      outputs[0].callbacks.onStarted();
      expect(player.getState().status).toBe('idle');
      expect(outputs).toHaveLength(1);
    });

    it('stop while loading prevents the output from ever starting', async () => {
      const { player, outputs } = setup();
      player.play(narration());
      player.stop();
      await flush();
      expect(outputs).toHaveLength(0);
      expect(player.getState().status).toBe('idle');
    });

    it('stop after the narration ended still resets to idle', async () => {
      const { player, outputs } = await playing();
      outputs[0].callbacks.onFinished();
      player.stop();
      expect(player.getState()).toEqual({ status: 'idle', narrationId: null, output: null });
    });

    it('is a no-op when idle', () => {
      const { player } = setup();
      const listener = jest.fn();
      player.subscribe(listener);
      player.stop();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('notifies on each visible state change', async () => {
      const { player, outputs } = setup();
      const listener = jest.fn();
      player.subscribe(listener);

      player.play(narration());
      expect(listener).toHaveBeenCalledTimes(1); // loading
      await flush();
      outputs[0].callbacks.onStarted();
      expect(listener).toHaveBeenCalledTimes(2); // playing
      player.pause();
      expect(listener).toHaveBeenCalledTimes(3);
      player.resume();
      expect(listener).toHaveBeenCalledTimes(4);
      outputs[0].callbacks.onFinished();
      expect(listener).toHaveBeenCalledTimes(5);
    });

    it('does not notify for ignored events', async () => {
      const { player, outputs } = await playing();
      const listener = jest.fn();
      player.subscribe(listener);
      player.resume(); // not paused
      outputs[0].callbacks.onStarted(); // already playing
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns a stable snapshot object while nothing visible changes', async () => {
      const { player, outputs } = await playing();
      const a = player.getState();
      outputs[0].callbacks.onStarted();
      expect(player.getState()).toBe(a);
    });

    it('stops notifying after unsubscribe', async () => {
      const { player } = setup();
      const listener = jest.fn();
      const unsubscribe = player.subscribe(listener);
      unsubscribe();
      player.play(narration());
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies multiple subscribers', () => {
      const { player } = setup();
      const a = jest.fn();
      const b = jest.fn();
      player.subscribe(a);
      player.subscribe(b);
      player.play(narration());
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('reports the failed state to subscribers', async () => {
      const { player, outputs } = await playing({ audio: null });
      const listener = jest.fn();
      player.subscribe(listener);
      outputs[0].callbacks.onError();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(player.getState().status).toBe('failed');
    });
  });
});
