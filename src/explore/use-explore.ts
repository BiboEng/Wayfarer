import type { NarrationResponse } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { getNearestLandmark } from '@/api/landmarks';
import { requestNarration } from '@/api/narration';
import { narrationAudioSource } from '@/api/narration-audio';
import { narrationPlayer, useNarrationPlayer, type PlayableNarration } from '@/audio';
import { settingsStore } from '@/settings';

import { exploreNarrationId, exploreReducer, INITIAL_EXPLORE_STATE, tappedPoint } from './explore-flow';
import type { ExploreView } from './explore-view';
import { toExploreView } from './to-explore-view';

/** Explore always narrates as if on foot; length and voice come from Settings. */
const EXPLORE_TRAVEL_MODE = 'walking';

export interface UseExplore {
  view: ExploreView;
  /** The last tapped point, for a small marker. */
  tapped: LatLng | null;
  /** The landmark found for the last tap, for the pin. */
  landmark: Landmark | null;
  onTap: (point: LatLng) => void;
  /** Runs the last tap again (after a failed search or story). */
  retry: () => void;
  pause: () => void;
  resume: () => void;
  /** Plays the current story again from the start. */
  replay: () => void;
  stop: () => void;
}

/** Explore mode: tap a point, find the nearest landmark, fetch and play its story. */
export function useExplore(): UseExplore {
  const [state, dispatch] = useReducer(exploreReducer, INITIAL_EXPLORE_STATE);
  const player = useNarrationPlayer();
  const latest = useRef(0);
  /** The story of the latest tap, kept for Replay. */
  const playable = useRef<PlayableNarration | null>(null);

  useEffect(() => {
    const ref = latest;
    return () => {
      const narrationId = exploreNarrationId(ref.current);
      ref.current += 1; // ignore responses after unmount
      // Leaving the screen ends Explore's story (but never someone else's).
      if (narrationPlayer.getState().narrationId === narrationId) narrationPlayer.stop();
    };
  }, []);

  const onTap = useCallback((point: LatLng) => {
    const requestId = ++latest.current;
    playable.current = null;
    narrationPlayer.stop(); // a new tap replaces the story in progress
    dispatch({ type: 'TAP', requestId, point });

    void getNearestLandmark(point).then((search) => {
      if (requestId !== latest.current) return;
      if (!search.ok) {
        dispatch({ type: 'SEARCH_FAILED', requestId, error: search.error });
        return;
      }
      const { landmark, searchedRadiusMeters } = search.data;
      dispatch({ type: 'SEARCH_DONE', requestId, landmark, searchedRadiusMeters });
      if (!landmark) return;

      const { length, voice } = settingsStore.get();
      void requestNarration({
        landmarkId: landmark.id,
        length,
        travelMode: EXPLORE_TRAVEL_MODE,
        ...(voice ? { voice } : {}),
      }).then((result) => {
        if (requestId !== latest.current) return;
        if (!result.ok) {
          dispatch({ type: 'NARRATION_FAILED', requestId, error: result.error });
          return;
        }
        // Start playing before the state update, so the card never shows "ended" before "starting".
        playable.current = toPlayable(exploreNarrationId(requestId), landmark.name, result.data);
        narrationPlayer.play(playable.current);
        dispatch({ type: 'NARRATION_DONE', requestId, narration: result.data });
      });
    });
  }, []);

  const tapped = tappedPoint(state);
  const retry = useCallback(() => {
    // The story already arrived and only playback failed: play it again, no new server calls.
    if (playable.current) narrationPlayer.play(playable.current);
    else if (tapped) onTap(tapped);
  }, [onTap, tapped]);

  const replay = useCallback(() => {
    if (playable.current) narrationPlayer.play(playable.current);
  }, []);

  const view = useMemo(() => toExploreView(state, player), [state, player]);
  const landmark = state.current.step === 'found' ? state.current.landmark : null;

  return {
    view,
    tapped,
    landmark,
    onTap,
    retry,
    pause: narrationPlayer.pause,
    resume: narrationPlayer.resume,
    replay,
    stop: narrationPlayer.stop,
  };
}

function toPlayable(id: string, title: string, narration: NarrationResponse): PlayableNarration {
  return {
    id,
    title,
    text: narration.text,
    audio: narration.audio ? narrationAudioSource(narration.audio) : null,
  };
}
