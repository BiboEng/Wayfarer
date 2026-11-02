/**
 * Live Tour reducer: (state, event) → { state, commands }. Pure: no React or Expo imports.
 * The session runs the commands (requests, player calls) and feeds results back as events.
 *
 * Rules it enforces:
 * - One story at a time. A story is played only when none is current: after the player reports
 *   the end, or after Skip/Replay (user actions). The app never cuts a story off by itself.
 * - No landmark twice in a tour (`tourIds`) or on the same day (`visited`).
 * - Nothing qualifies → nothing happens (no filler).
 * - A failed request is dropped quietly; it is retried after the next search. After a failure the
 *   next search comes after a minute even without moving (once per minute while failing).
 * - Results carry request ids; stale ones are ignored.
 * - Driving: a story that arrives once its place is behind (or 1.5× the radius away) is dropped.
 * - At most one pre-fetch, used when it is still the top pick after the current story.
 * - A place with a story request on its way is never requested twice.
 * - Driving with a known heading: the search is centred ahead (ranking still uses the real position).
 */
import type { TravelMode } from '@shared/narration/options';

import { destinationPoint } from './bearing';
import { profileFor } from './mode-profile';
import { isRetryDue, RETRY_AFTER_MS, shouldRecheck } from './recheck';
import { isStaleStory } from './staleness';
import type { TourCommand, TourEvent, TourMachineState, TourStep } from './tour-machine-types';
import { advance, fetchStory, holdAfterFailure, settleRequest, startPlaying } from './tour-steps';
import { emptyDay, localDateKey, visitedForDay } from './visited';

export function initialTourState(mode: TravelMode): TourMachineState {
  return {
    now: 0,
    mode,
    position: null,
    headingDeg: null,
    lastCheckAt: null,
    lastCheckTime: null,
    retryDueAt: null,
    nearbyRequestId: null,
    nearby: [],
    visited: null,
    tourIds: [],
    failedIds: [],
    holdUntilCheck: false,
    history: [],
    stories: {},
    storyRequests: {},
    current: null,
    prefetch: null,
    paused: false,
    nextRequestId: 1,
    playCount: 0,
  };
}

export function tourReducer(state: TourMachineState, event: TourEvent): TourStep {
  const out: TourCommand[] = [];
  const next = reduce(state, event, out);
  return { state: next, commands: out };
}

function reduce(state: TourMachineState, event: TourEvent, out: TourCommand[]): TourMachineState {
  switch (event.type) {
    case 'FIX':
      return onFix(state, event, out);

    case 'VISITED_LOADED':
      return advance({ ...state, visited: visitedForDay(event.day, event.today) }, out);

    case 'NEARBY_RESULT':
      if (event.requestId !== state.nearbyRequestId) return state;
      return advance({ ...state, nearbyRequestId: null, nearby: event.landmarks }, out);

    case 'NEARBY_FAILED': {
      // Keep the previous results; search again a minute after this one, even without moving.
      if (event.requestId !== state.nearbyRequestId) return state;
      const retryDueAt = (state.lastCheckTime ?? state.now) + RETRY_AFTER_MS;
      return advance({ ...state, nearbyRequestId: null, retryDueAt }, out);
    }

    case 'NARRATION_READY':
      return onNarrationReady(state, event, out);

    case 'NARRATION_FAILED':
      return onNarrationFailed(state, event.requestId, out);

    case 'PLAYBACK_ENDED': {
      const { current } = state;
      if (current?.phase !== 'playing' || current.narrationId !== event.narrationId) return state;
      // A story that could not be played at all (e.g. broken TTS) still moves on, but holds
      // until the next check so failures don't burn story requests one candidate after another.
      const next = { ...state, current: null };
      return advance(event.failed ? holdAfterFailure(next) : next, out);
    }

    case 'PAUSE':
      if (state.paused) return state;
      if (state.current?.phase === 'playing') out.push({ type: 'pausePlayback' });
      return { ...state, paused: true };

    case 'RESUME':
      return onResume(state, out);

    case 'SKIP':
      return onSkip(state, out);

    case 'REPLAY':
      return onReplay(state, event.landmarkId, out);
  }
}

function onFix(state: TourMachineState, event: Extract<TourEvent, { type: 'FIX' }>, out: TourCommand[]): TourMachineState {
  const { position, headingDeg, mode, now } = event;
  let next: TourMachineState = { ...state, position, headingDeg, mode, now };

  // After midnight, today's list starts empty (the tour's own list still applies).
  const today = localDateKey(now);
  if (next.visited && next.visited.date !== today) next = { ...next, visited: emptyDay(today) };

  const profile = profileFor(mode);
  const due =
    mode !== state.mode || shouldRecheck(next.lastCheckAt, position, profile.recheckEveryM) || isRetryDue(next.retryDueAt, now);
  if (due) {
    const requestId = next.nextRequestId;
    // Driving: centre the search ahead, so the server's nearest-pages cap goes to places still to come.
    const center =
      profile.searchAheadM > 0 && headingDeg !== null ? destinationPoint(position, headingDeg, profile.searchAheadM) : position;
    out.push({ type: 'fetchNearby', requestId, center, radiusM: profile.radiusM });
    next = {
      ...next,
      lastCheckAt: position,
      lastCheckTime: now,
      retryDueAt: null,
      nearbyRequestId: requestId,
      nextRequestId: requestId + 1,
      failedIds: [],
      holdUntilCheck: false,
    };
  }
  return advance(next, out);
}

function onNarrationReady(
  state: TourMachineState,
  event: Extract<TourEvent, { type: 'NARRATION_READY' }>,
  out: TourCommand[],
): TourMachineState {
  const { requestId, narration } = event;
  // Keep every story received in this tour, even late ones: replay and later picks can use it.
  const next = settleRequest({ ...state, stories: { ...state.stories, [narration.landmarkId]: narration } }, requestId);
  const { current, prefetch } = state;

  if (current?.phase === 'fetching' && current.requestId === requestId) {
    const { landmark, side, replay } = current;
    if (!replay && next.position && isStaleStory(next.position, next.headingDeg, landmark.location, profileFor(next.mode))) {
      return advance({ ...next, current: null }, out);
    }
    if (next.paused) return { ...next, current: { phase: 'ready', landmark, side, narration, replay } };
    return startPlaying({ ...next, current: null }, landmark, narration, replay, out);
  }
  if (prefetch?.requestId === requestId) return { ...next, prefetch: { ...prefetch, narration } };
  // An abandoned request came back: if nothing is current, it may be the one wanted now.
  return next.current ? next : advance(next, out);
}

function onNarrationFailed(state: TourMachineState, requestId: number, out: TourCommand[]): TourMachineState {
  const { current, prefetch } = state;
  const next = settleRequest(state, requestId);
  if (current?.phase === 'fetching' && current.requestId === requestId) {
    if (current.replay) return advance({ ...next, current: null }, out);
    return holdAfterFailure({ ...next, current: null, failedIds: [...next.failedIds, current.landmark.id] });
  }
  if (prefetch?.requestId === requestId) {
    return { ...next, prefetch: null, failedIds: [...next.failedIds, prefetch.landmark.id] };
  }
  return next;
}

function onResume(state: TourMachineState, out: TourCommand[]): TourMachineState {
  const next = { ...state, paused: false };
  const { current } = next;
  if (current?.phase === 'playing') {
    // Also resumes after the system paused the sound (audio focus), even if we never paused.
    out.push({ type: 'resumePlayback' });
    return advance(next, out);
  }
  if (current?.phase === 'ready') {
    const { landmark, narration, replay } = current;
    const stale = !replay && next.position && isStaleStory(next.position, next.headingDeg, landmark.location, profileFor(next.mode));
    if (stale) return advance({ ...next, current: null }, out);
    return startPlaying({ ...next, current: null }, landmark, narration, replay, out);
  }
  return advance(next, out);
}

/** Ends the current story (it stays visited) and moves on. Skipping also un-pauses. */
function onSkip(state: TourMachineState, out: TourCommand[]): TourMachineState {
  const { current } = state;
  let next: TourMachineState = { ...state, paused: false, current: null };
  if (current?.phase === 'playing') out.push({ type: 'stopPlayback' });
  else if (current && !current.replay) {
    // Skipped before it played: don't offer it again in this tour.
    if (!next.tourIds.includes(current.landmark.id)) next = { ...next, tourIds: [...next.tourIds, current.landmark.id] };
  }
  return advance(next, out);
}

/** Plays a place from this tour's history again, now (a user action, so it may replace a story). */
function onReplay(state: TourMachineState, landmarkId: string, out: TourCommand[]): TourMachineState {
  const entry = state.history.find((item) => item.landmark.id === landmarkId);
  if (!entry) return state;
  const playing = state.current?.phase === 'playing';
  const next: TourMachineState = { ...state, paused: false, current: null };
  const known = state.stories[landmarkId];
  if (known) return startPlaying(next, entry.landmark, known, true, out);
  if (playing) out.push({ type: 'stopPlayback' });
  return fetchStory(next, entry.landmark, true, out);
}
