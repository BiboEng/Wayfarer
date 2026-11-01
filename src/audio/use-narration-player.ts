import { useSyncExternalStore } from 'react';

import { narrationPlayer } from './narration-player';
import type { PlayerState } from './types';

/** The narration player's state; re-renders only when status, narration or output changes. */
export function useNarrationPlayer(): PlayerState {
  return useSyncExternalStore(narrationPlayer.subscribe, narrationPlayer.getState);
}
