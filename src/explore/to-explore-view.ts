import { distanceMeters } from '@shared/geo/distance';

import { narrationErrorMessage, searchErrorMessage } from './error-message';
import { exploreNarrationId, type ExploreFlowState, type NarrationFlow } from './explore-flow';
import type { ExploreView, NarrationOutput, NarrationView } from './explore-view';

/** The parts of the narration player's state the Explore card needs (matches `PlayerState` in `src/audio`). */
export interface PlayerSnapshot {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'failed';
  narrationId: string | null;
  output: NarrationOutput | null;
}

/** Combines the Explore flow with the player's state into what the card shows. */
export function toExploreView(state: ExploreFlowState, player: PlayerSnapshot): ExploreView {
  const { current } = state;
  switch (current.step) {
    case 'idle':
      return { kind: 'hint' };
    case 'searching':
      return { kind: 'searching' };
    case 'nothing':
      return { kind: 'nothing', radiusKm: Math.round(current.radiusMeters / 1000) };
    case 'search-failed':
      return { kind: 'error', message: searchErrorMessage(current.error) };
    case 'found':
      return {
        kind: 'landmark',
        landmark: current.landmark,
        distanceMeters: distanceMeters(current.tap, current.landmark.location),
        narration: toNarrationView(current.narration, player, exploreNarrationId(state.requestId)),
      };
  }
}

function toNarrationView(flow: NarrationFlow, player: PlayerSnapshot, narrationId: string): NarrationView {
  if (flow.status === 'requesting') return { status: 'writing' };
  if (flow.status === 'failed') return { status: 'unavailable', ...narrationErrorMessage(flow.error) };

  const { text } = flow.narration;
  // Another narration owns the player, or it was stopped: this one is over.
  if (player.narrationId !== narrationId) return { status: 'ended', text };

  switch (player.status) {
    case 'loading':
      return { status: 'starting', text };
    case 'playing':
    case 'paused':
      return { status: player.status, output: player.output ?? 'audio', text };
    case 'failed':
      return { status: 'unavailable', message: "Couldn't play the story.", retryable: true, text };
    case 'idle':
    case 'ended':
      return { status: 'ended', text };
  }
}
