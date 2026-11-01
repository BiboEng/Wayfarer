/**
 * Narration player state machine. Pure: no React or Expo imports.
 *
 * Every playback gets a token. `PLAY_REQUESTED`, `STOP` and the fallback to the device voice
 * issue a new one; events from an output carry the token it was started with, and events with
 * an old token are ignored, so a late callback from a stopped sound can never change state.
 */
import type { PlayerOutput, PlayerState } from './types';

export interface MachineState extends PlayerState {
  /** Token of the current playback; output events must carry it to count. */
  token: number;
}

export const INITIAL_MACHINE_STATE: MachineState = {
  status: 'idle',
  narrationId: null,
  output: null,
  token: 0,
};

export type MachineEvent =
  | { type: 'PLAY_REQUESTED'; narrationId: string; output: PlayerOutput }
  | { type: 'OUTPUT_STARTED'; token: number }
  /** Paused by the user, or by the system (audio focus lost, app in background). */
  | { type: 'PAUSED'; token: number }
  | { type: 'RESUMED'; token: number }
  | { type: 'FINISHED'; token: number }
  /** The output failed. Audio falls back to the device voice; the device voice fails for good. */
  | { type: 'OUTPUT_ERROR'; token: number }
  | { type: 'STOP' };

/** Returns the same object when the event changes nothing, so callers can skip notifying. */
export function playerReducer(state: MachineState, event: MachineEvent): MachineState {
  switch (event.type) {
    case 'PLAY_REQUESTED':
      return { status: 'loading', narrationId: event.narrationId, output: event.output, token: state.token + 1 };

    case 'STOP':
      if (state.status === 'idle') return state;
      return { ...INITIAL_MACHINE_STATE, token: state.token + 1 };

    default:
      if (event.token !== state.token) return state;
      return onOutputEvent(state, event);
  }
}

type OutputEvent = Exclude<MachineEvent, { type: 'PLAY_REQUESTED' } | { type: 'STOP' }>;

function onOutputEvent(state: MachineState, event: OutputEvent): MachineState {
  const { status } = state;
  switch (event.type) {
    case 'OUTPUT_STARTED':
      return status === 'loading' ? { ...state, status: 'playing' } : state;

    case 'PAUSED':
      return status === 'playing' ? { ...state, status: 'paused' } : state;

    case 'RESUMED':
      return status === 'paused' ? { ...state, status: 'playing' } : state;

    case 'FINISHED':
      return isActive(state) ? { ...state, status: 'ended' } : state;

    case 'OUTPUT_ERROR':
      if (!isActive(state)) return state;
      if (state.output === 'audio') {
        // Fall back to the device voice. If the user had paused, stay paused until they resume.
        const fallbackStatus = status === 'paused' ? 'paused' : 'loading';
        return { ...state, status: fallbackStatus, output: 'device-voice', token: state.token + 1 };
      }
      return { ...state, status: 'failed' };
  }
}

/** True while an output is (or should be) making sound for the current narration. */
export function isActive(state: PlayerState): boolean {
  return state.status === 'loading' || state.status === 'playing' || state.status === 'paused';
}
