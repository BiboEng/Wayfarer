import type { NarrationResponse } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';

import type { ClientError } from '@/api/client';

export type NarrationFlow =
  | { status: 'requesting' }
  | { status: 'ready'; narration: NarrationResponse }
  | { status: 'failed'; error: ClientError };

export type ExploreStep =
  | { step: 'idle' }
  | { step: 'searching'; tap: LatLng }
  | { step: 'nothing'; tap: LatLng; radiusMeters: number }
  | { step: 'search-failed'; tap: LatLng; error: ClientError }
  | { step: 'found'; tap: LatLng; landmark: Landmark; narration: NarrationFlow };

export interface ExploreFlowState {
  /** Id of the latest tap. Results carrying an older id are stale and ignored. */
  requestId: number;
  current: ExploreStep;
}

export type ExploreEvent =
  | { type: 'TAP'; requestId: number; point: LatLng }
  | { type: 'SEARCH_DONE'; requestId: number; landmark: Landmark | null; searchedRadiusMeters: number }
  | { type: 'SEARCH_FAILED'; requestId: number; error: ClientError }
  | { type: 'NARRATION_DONE'; requestId: number; narration: NarrationResponse }
  | { type: 'NARRATION_FAILED'; requestId: number; error: ClientError };

export const INITIAL_EXPLORE_STATE: ExploreFlowState = { requestId: 0, current: { step: 'idle' } };

/** Tap → search → (narration). A new tap replaces whatever was in progress. */
export function exploreReducer(state: ExploreFlowState, event: ExploreEvent): ExploreFlowState {
  if (event.type === 'TAP') {
    return { requestId: event.requestId, current: { step: 'searching', tap: event.point } };
  }
  if (event.requestId !== state.requestId) return state;

  const { current } = state;
  switch (event.type) {
    case 'SEARCH_DONE':
      if (current.step !== 'searching') return state;
      return {
        ...state,
        current: event.landmark
          ? { step: 'found', tap: current.tap, landmark: event.landmark, narration: { status: 'requesting' } }
          : { step: 'nothing', tap: current.tap, radiusMeters: event.searchedRadiusMeters },
      };
    case 'SEARCH_FAILED':
      if (current.step !== 'searching') return state;
      return { ...state, current: { step: 'search-failed', tap: current.tap, error: event.error } };
    case 'NARRATION_DONE':
      if (current.step !== 'found' || current.narration.status !== 'requesting') return state;
      return { ...state, current: { ...current, narration: { status: 'ready', narration: event.narration } } };
    case 'NARRATION_FAILED':
      if (current.step !== 'found' || current.narration.status !== 'requesting') return state;
      return { ...state, current: { ...current, narration: { status: 'failed', error: event.error } } };
  }
}

/** The point the user tapped last, if any. */
export function tappedPoint(state: ExploreFlowState): LatLng | null {
  return state.current.step === 'idle' ? null : state.current.tap;
}

/** The player id for the narration of one tap, so player state can be matched to it. */
export function exploreNarrationId(requestId: number): string {
  return `explore:${requestId}`;
}
