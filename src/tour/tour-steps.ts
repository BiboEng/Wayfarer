/**
 * Building blocks of the tour reducer: pick the next story, start playing, pre-fetch.
 * Pure: no React or Expo imports. Each takes the state and a command list to append to.
 */
import type { NarrationResponse } from '@shared/api/narration';
import type { Landmark } from '@shared/landmarks/landmark';

import { profileFor } from './mode-profile';
import { orientationSide } from './orientation';
import { bestCandidate, type RankedCandidate } from './ranking';
import { RETRY_AFTER_MS } from './recheck';
import type { TourCommand, TourMachineState } from './tour-machine-types';
import { addVisited } from './visited';

/** Prefix of the player ids the tour owns. */
export const TOUR_NARRATION_PREFIX = 'tour:';

/** Landmarks that must not be picked now. */
export function excludedIds(state: TourMachineState): Set<string> {
  const ids = new Set([...state.tourIds, ...state.failedIds, ...(state.visited?.ids ?? [])]);
  if (state.current) ids.add(state.current.landmark.id);
  return ids;
}

/** The best landmark to narrate next from the latest search, or null (stay silent). */
export function topCandidate(state: TourMachineState): RankedCandidate | null {
  if (!state.position) return null;
  return bestCandidate(state.nearby, {
    position: state.position,
    headingDeg: state.headingDeg,
    profile: profileFor(state.mode),
    excluded: excludedIds(state),
  });
}

/**
 * Moves the queue on: with no current story, picks and fetches (or plays) the best candidate;
 * while one plays, pre-fetches the next. Silent when nothing qualifies.
 */
export function advance(state: TourMachineState, out: TourCommand[]): TourMachineState {
  if (!state.visited || !state.position) return state;
  if (state.current) return maybePrefetch(state, out);
  if (state.paused || state.holdUntilCheck) return state;

  const top = topCandidate(state);
  if (!top) return state;
  const { landmark } = top;
  const { prefetch } = state;
  const next = { ...state, prefetch: null };

  if (prefetch?.landmark.id === landmark.id && !prefetch.narration) {
    // The pre-fetch is still on its way: adopt its request instead of asking again.
    const side = orientationSide(state.position, state.headingDeg, landmark.location);
    return { ...next, current: { phase: 'fetching', landmark, side, requestId: prefetch.requestId, replay: false } };
  }
  // Pre-fetched or received earlier in this tour. (A pre-fetch for another place is dropped;
  // its story stays in `stories` and on the server's cache.)
  const known = state.stories[landmark.id];
  if (known) return startPlaying(next, landmark, known, false, out);
  return fetchStory(next, landmark, false, out);
}

/**
 * Requests a story and makes it the current one. A request already on its way for this place
 * (e.g. abandoned by Skip or Replay) is adopted instead of asking again.
 */
export function fetchStory(state: TourMachineState, landmark: Landmark, replay: boolean, out: TourCommand[]): TourMachineState {
  const side = replay ? null : orientationSide(state.position, state.headingDeg, landmark.location);
  const inFlight = state.storyRequests[landmark.id];
  if (inFlight !== undefined) return { ...state, current: { phase: 'fetching', landmark, side, requestId: inFlight, replay } };
  const next = requestStory(state, landmark.id, 'fetchNarration', out);
  return { ...next, current: { phase: 'fetching', landmark, side, requestId: state.nextRequestId, replay } };
}

/** Issues a story request (current or pre-fetch) and records it as in flight. */
function requestStory(
  state: TourMachineState,
  landmarkId: string,
  type: 'fetchNarration' | 'prefetch',
  out: TourCommand[],
): TourMachineState {
  const requestId = state.nextRequestId;
  out.push({ type, requestId, landmarkId, travelMode: profileFor(state.mode).travelMode });
  return { ...state, nextRequestId: requestId + 1, storyRequests: { ...state.storyRequests, [landmarkId]: requestId } };
}

/** Removes a finished request (answered or failed) from the in-flight list. */
export function settleRequest(state: TourMachineState, requestId: number): TourMachineState {
  const entry = Object.entries(state.storyRequests).find(([, id]) => id === requestId);
  if (!entry) return state;
  const storyRequests = { ...state.storyRequests };
  delete storyRequests[entry[0]];
  return { ...state, storyRequests };
}

/** A story request or its playback failed: pick nothing new until the next check, due in a minute. */
export function holdAfterFailure(state: TourMachineState): TourMachineState {
  const retryDueAt = Math.max(state.retryDueAt ?? 0, state.now + RETRY_AFTER_MS);
  return { ...state, holdUntilCheck: true, retryDueAt };
}

/**
 * Hands a story to the player. Callers guarantee nothing else is playing (or that the user asked
 * to replace it). A new story is marked visited (tour + today) and added to the history.
 */
export function startPlaying(
  state: TourMachineState,
  landmark: Landmark,
  narration: NarrationResponse,
  replay: boolean,
  out: TourCommand[],
): TourMachineState {
  const playCount = state.playCount + 1;
  const narrationId = `${TOUR_NARRATION_PREFIX}${playCount}:${landmark.id}`;
  // A replay is "play it again now": no "coming up" line.
  const side = replay ? null : orientationSide(state.position, state.headingDeg, landmark.location);
  out.push({ type: 'play', narrationId, landmark, narration, side });

  let next: TourMachineState = {
    ...state,
    playCount,
    stories: { ...state.stories, [landmark.id]: narration },
    current: { phase: 'playing', landmark, side, narration, narrationId },
  };
  if (!replay) {
    const visited = state.visited ? addVisited(state.visited, landmark.id) : state.visited;
    if (visited) out.push({ type: 'saveVisited', day: visited });
    next = {
      ...next,
      visited,
      tourIds: next.tourIds.includes(landmark.id) ? next.tourIds : [...next.tourIds, landmark.id],
      history: [{ landmark, narratedAt: state.now }, ...next.history],
    };
  }
  return maybePrefetch(next, out);
}

/** While a story plays, requests the next best one (at most one pre-fetch at a time). */
export function maybePrefetch(state: TourMachineState, out: TourCommand[]): TourMachineState {
  if (state.paused || state.prefetch || state.holdUntilCheck || state.current?.phase !== 'playing') return state;
  const top = topCandidate(state);
  if (!top || state.stories[top.landmark.id]) return state;
  const { landmark } = top;
  const inFlight = state.storyRequests[landmark.id];
  if (inFlight !== undefined) return { ...state, prefetch: { landmark, requestId: inFlight, narration: null } };
  const next = requestStory(state, landmark.id, 'prefetch', out);
  return { ...next, prefetch: { landmark, requestId: state.nextRequestId, narration: null } };
}
