import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import type { TravelMode } from '@shared/narration/options';

import { initialTourState, tourReducer } from '../tour-machine';
import type { TourCommand, TourEvent, TourMachineState } from '../tour-machine-types';
import { localDateKey, type VisitedDay } from '../visited';
import { narrationFor, ORIGIN } from './places';

/** Local noon on a fixed day, so day rules never depend on when the tests run. */
export const NOON = new Date(2026, 5, 10, 12, 0, 0).getTime();
export const TODAY = localDateKey(NOON);

export type CommandOf<T extends TourCommand['type']> = Extract<TourCommand, { type: T }>;

export function commandsOf<T extends TourCommand['type']>(commands: readonly TourCommand[], type: T): CommandOf<T>[] {
  return commands.filter((command): command is CommandOf<T> => command.type === type);
}

/** Events that may legitimately start a story while another one plays (the user acted). */
const USER_ACTIONS: TourEvent['type'][] = ['REPLAY', 'SKIP'];

/**
 * Drives the reducer like the session does and records every command. Also checks the
 * no-overlap rule on every step: a `play` while a story is playing is only allowed after a user action.
 */
export function createHarness(options: { mode?: TravelMode } = {}) {
  let state: TourMachineState = initialTourState(options.mode ?? 'walking');
  const log: TourCommand[] = [];
  const violations: string[] = [];
  let mode: TravelMode = options.mode ?? 'walking';
  let now = NOON;

  function send(event: TourEvent): TourCommand[] {
    const before = state;
    const step = tourReducer(state, event);
    state = step.state;
    log.push(...step.commands);
    const plays = commandsOf(step.commands, 'play');
    if (plays.length > 1) violations.push(`${event.type}: ${plays.length} play commands in one step`);
    const endedItsStory =
      event.type === 'PLAYBACK_ENDED' && before.current?.phase === 'playing' && before.current.narrationId === event.narrationId;
    if (plays.length > 0 && before.current?.phase === 'playing' && !endedItsStory && !USER_ACTIONS.includes(event.type)) {
      violations.push(`${event.type}: play while ${before.current.landmark.id} was playing`);
    }
    return step.commands;
  }

  const h = {
    get state() {
      return state;
    },
    log,
    violations,
    send,
    /** Today's list loaded from storage (null = nothing stored). */
    loadVisited(day: VisitedDay | null = null, today = TODAY) {
      return send({ type: 'VISITED_LOADED', day, today });
    },
    fix(position: LatLng = ORIGIN, heading: number | null = null, over: { mode?: TravelMode; now?: number } = {}) {
      mode = over.mode ?? mode;
      now = over.now ?? now;
      return send({ type: 'FIX', position, headingDeg: heading, mode, now });
    },
    /** Answers the search in flight with these landmarks. */
    nearby(landmarks: Landmark[]) {
      const requestId = state.nearbyRequestId;
      if (requestId === null) throw new Error('no search in flight');
      return send({ type: 'NEARBY_RESULT', requestId, landmarks });
    },
    /** The latest story request (current or pre-fetch) for this landmark. */
    requestIdFor(landmarkId: string): number {
      const request = [...log].reverse().find((c) => (c.type === 'fetchNarration' || c.type === 'prefetch') && c.landmarkId === landmarkId);
      if (!request || (request.type !== 'fetchNarration' && request.type !== 'prefetch')) throw new Error(`no request for ${landmarkId}`);
      return request.requestId;
    },
    deliver(landmarkId: string) {
      return send({ type: 'NARRATION_READY', requestId: h.requestIdFor(landmarkId), narration: narrationFor(landmarkId) });
    },
    failRequest(landmarkId: string) {
      return send({ type: 'NARRATION_FAILED', requestId: h.requestIdFor(landmarkId) });
    },
    /** The player reports the current story finished. */
    ended(failed = false) {
      const { current } = state;
      if (current?.phase !== 'playing') throw new Error('nothing is playing');
      return send({ type: 'PLAYBACK_ENDED', narrationId: current.narrationId, failed });
    },
    /** Id of the landmark playing now, or null. */
    playingId(): string | null {
      return state.current?.phase === 'playing' ? state.current.landmark.id : null;
    },
    /** Landmark ids the reducer has sent to the player, in order. */
    playedIds(): string[] {
      return commandsOf(log, 'play').map((c) => c.landmark.id);
    },
    /** Starts a tour with these places nearby: visited loaded, first fix, search answered. */
    begin(landmarks: Landmark[], position: LatLng = ORIGIN, heading: number | null = null) {
      h.loadVisited();
      h.fix(position, heading);
      return h.nearby(landmarks);
    },
  };
  return h;
}

export type Harness = ReturnType<typeof createHarness>;
