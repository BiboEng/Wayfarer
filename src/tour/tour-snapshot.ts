/** Builds what the Live Tour screen renders from the session's state. Pure: no React or Expo imports. */
import type { LatLng } from '@shared/geo/lat-lng';

import type { TourMachineState } from './tour-machine-types';
import type { CurrentNarration, TourSnapshot, TourSource } from './types';

/** Where the session is, outside the reducer: permission checks happen before tracking starts. */
export type SessionPhase =
  | 'idle'
  | 'needs-permission'
  | 'permission-denied'
  | 'location-approximate'
  | 'location-off'
  | 'running';

export interface SnapshotInput {
  phase: SessionPhase;
  source: TourSource;
  machine: TourMachineState;
  modeFixed: boolean;
  /** The player paused the tour's story by itself (audio focus lost). */
  playerPaused: boolean;
  /** Latest position from any fix, even one too rough to steer the tour (for the map dot). */
  displayPosition?: LatLng | null;
}

export function toTourSnapshot({ phase, source, machine, modeFixed, playerPaused, displayPosition }: SnapshotInput): TourSnapshot {
  return {
    status: phase === 'running' ? runningStatus(machine, playerPaused) : phase,
    mode: machine.mode,
    modeFixed,
    source,
    position: displayPosition ?? machine.position,
    headingDeg: machine.headingDeg,
    nearby: machine.nearby,
    current: currentNarration(machine),
    history: machine.history,
  };
}

function runningStatus(machine: TourMachineState, playerPaused: boolean): TourSnapshot['status'] {
  const { current } = machine;
  if (machine.paused || (current?.phase === 'playing' && playerPaused)) return 'paused';
  if (current?.phase === 'fetching') return 'preparing';
  if (current?.phase === 'playing') return 'narrating';
  return 'listening';
}

export function currentNarration({ current }: TourMachineState): CurrentNarration | null {
  if (!current) return null;
  return { landmark: current.landmark, side: current.side, text: current.phase === 'fetching' ? '' : current.narration.text };
}

/** True when the screen would render the same thing (so listeners aren't woken for nothing). */
export function sameSnapshot(a: TourSnapshot, b: TourSnapshot): boolean {
  return (
    a.status === b.status &&
    a.mode === b.mode &&
    a.modeFixed === b.modeFixed &&
    a.source === b.source &&
    a.position === b.position &&
    a.headingDeg === b.headingDeg &&
    a.nearby === b.nearby &&
    a.history === b.history &&
    sameCurrent(a.current, b.current)
  );
}

function sameCurrent(a: CurrentNarration | null, b: CurrentNarration | null): boolean {
  if (a === null || b === null) return a === b;
  return a.landmark === b.landmark && a.side === b.side && a.text === b.text;
}
