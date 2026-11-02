/**
 * Narration player state machine. Pure: no React or Expo imports.
 *
 * Every playback gets a token. `PLAY_REQUESTED`, `STOP` and the fallback to the device voice
 * issue a new one; events from an output carry the token it was started with, and events with
 * an old token are ignored, so a late callback from a stopped sound can never change state.
 *
 * A narration may have an intro: while it plays, `pendingMain` holds the output of the main part.
 * When the intro finishes or fails, the main part starts with a new token; the status carries on
 * (one narration, one status), and `ended` only comes after the main part.
 */
import type { PlayerOutput, PlayerState } from './types';

export interface MachineState extends PlayerState {
  /** Token of the current playback; output events must carry it to count. */
  token: number;
  /** Set while the intro plays: the output the main part uses next. Absent otherwise. */
  pendingMain?: PlayerOutput;
}

export const INITIAL_MACHINE_STATE: MachineState = {
  status: 'idle',
  narrationId: null,
  output: null,
  token: 0,
};

export type MachineEvent =
  /** `output` is the main part's; `introOutput` (optional) plays first. */
  | { type: 'PLAY_REQUESTED'; narrationId: string; output: PlayerOutput; introOutput?: PlayerOutput | null }
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
    case 'PLAY_REQUESTED': {
      const base = { status: 'loading' as const, narrationId: event.narrationId, token: state.token + 1 };
      return event.introOutput
        ? { ...base, output: event.introOutput, pendingMain: event.output }
        : { ...base, output: event.output };
    }

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
  // The intro finished or failed: go on to the main part (a failed intro is skipped silently).
  if (state.pendingMain && isActive(state) && (event.type === 'FINISHED' || event.type === 'OUTPUT_ERROR')) {
    return toMainPart(state);
  }
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

function toMainPart({ pendingMain, ...state }: MachineState): MachineState {
  return { ...state, output: pendingMain ?? state.output, token: state.token + 1 };
}

/** True while an output is (or should be) making sound for the current narration. */
export function isActive(state: PlayerState): boolean {
  return state.status === 'loading' || state.status === 'playing' || state.status === 'paused';
}
