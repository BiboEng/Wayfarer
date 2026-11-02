/**
 * Wires the state machine to the sound outputs. No React or Expo imports: the outputs are
 * passed in, so this can be tested with fakes.
 */
import { introOutputFor } from './intro-output';
import type { PlaybackCallbacks, PlaybackOutput, StartAudioFile, StartDeviceVoice } from './playback-output';
import { INITIAL_MACHINE_STATE, playerReducer, type MachineEvent, type MachineState } from './player-machine';
import type { NarrationPlayer, PlayableNarration, PlayerState } from './types';

export interface NarrationPlayerDeps {
  startAudioFile: StartAudioFile;
  startDeviceVoice: StartDeviceVoice;
  /** Configures the audio session; awaited before each output starts. Should not reject. */
  prepareAudio: () => Promise<void>;
}

export function createNarrationPlayer(deps: NarrationPlayerDeps): NarrationPlayer {
  let machine: MachineState = INITIAL_MACHINE_STATE;
  let snapshot: PlayerState = toPlayerState(machine);
  let narration: PlayableNarration | null = null;
  /** The one output allowed to make sound. */
  let current: PlaybackOutput | null = null;
  const listeners = new Set<() => void>();

  function dispatch(event: MachineEvent): MachineState {
    const next = playerReducer(machine, event);
    if (next === machine) return machine;
    machine = next;
    if (next.status !== snapshot.status || next.narrationId !== snapshot.narrationId || next.output !== snapshot.output) {
      snapshot = toPlayerState(next);
      listeners.forEach((listener) => listener());
    }
    return next;
  }

  function stopOutput(): void {
    const output = current;
    current = null;
    output?.stop();
  }

  function startOutput(token: number): void {
    if (token !== machine.token || !narration) return;
    const callbacks = callbacksFor(token);
    // While `pendingMain` is set, the intro is playing; otherwise the main part.
    const part = machine.pendingMain && narration.intro ? narration.intro : narration;
    const output =
      machine.output === 'audio' && part.audio
        ? deps.startAudioFile(part.audio, callbacks)
        : deps.startDeviceVoice(part.text, callbacks);
    // Defensive: if the playback changed while starting, this output must stay silent.
    if (token === machine.token) current = output;
    else output.stop();
  }

  /** Starts the part the machine moved on to. If paused, it starts on resume() instead. */
  function startNextPart(previousToken: number, next: MachineState): void {
    if (next.token === previousToken) return;
    if (next.status === 'loading' || next.status === 'playing') startOutput(next.token);
  }

  function callbacksFor(token: number): PlaybackCallbacks {
    return {
      onStarted: () => dispatch({ type: 'OUTPUT_STARTED', token }),
      onFinished: () => {
        if (token !== machine.token) return;
        current = null;
        // After the intro, the machine moves on to the main part with a new token.
        startNextPart(token, dispatch({ type: 'FINISHED', token }));
      },
      onError: () => {
        if (token !== machine.token) return;
        stopOutput();
        // A failed intro is skipped; failed main audio falls back to the device voice.
        startNextPart(token, dispatch({ type: 'OUTPUT_ERROR', token }));
      },
      onInterrupted: (paused) => dispatch({ type: paused ? 'PAUSED' : 'RESUMED', token }),
    };
  }

  return {
    play(next) {
      stopOutput();
      narration = next;
      const { token } = dispatch({
        type: 'PLAY_REQUESTED',
        narrationId: next.id,
        output: next.audio ? 'audio' : 'device-voice',
        introOutput: introOutputFor(next),
      });
      void deps
        .prepareAudio()
        .catch(() => undefined)
        .then(() => startOutput(token));
    },
    pause() {
      if (machine.status !== 'playing') return;
      current?.pause();
      dispatch({ type: 'PAUSED', token: machine.token });
    },
    resume() {
      if (machine.status !== 'paused') return;
      const { token } = machine;
      if (current) current.resume();
      else startOutput(token); // the previous part ended or failed while paused: start the next one now
      dispatch({ type: 'RESUMED', token });
    },
    stop() {
      stopOutput();
      narration = null;
      dispatch({ type: 'STOP' });
    },
    getState: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function toPlayerState({ status, narrationId, output }: MachineState): PlayerState {
  return { status, narrationId, output };
}
