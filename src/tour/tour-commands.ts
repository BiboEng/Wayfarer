/**
 * Runs the reducer's commands: server requests, player calls, saving the visited list.
 * Every failure becomes a quiet event (no popups); dev builds log the error code only.
 * No React or Expo imports: everything is injected.
 */
import type { CueResponse } from '@shared/api/cues';
import type { NearbyLandmarksResponse } from '@shared/api/landmarks';
import type { NarrationAudio, NarrationRequest, NarrationResponse } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { OrientationCue } from '@shared/narration/cues';
import type { TravelMode, VoiceId } from '@shared/narration/options';

import type { ApiResult } from '@/api/client';
import type { RemoteSound } from '@/audio/types';
import type { TourSettings } from '@/settings/types';

import type { CueCache } from './cue-cache';
import type { PlayerLink } from './player-link';
import type { TourCommand, TourEvent } from './tour-machine-types';
import type { VisitedStore } from './visited-storage';

/** The server calls the tour makes. They never throw (they return ApiResult). */
export interface TourApi {
  getNearbyLandmarks(center: LatLng, radiusMeters: number): Promise<ApiResult<NearbyLandmarksResponse>>;
  requestNarration(request: NarrationRequest): Promise<ApiResult<NarrationResponse>>;
  getCue(cue: OrientationCue, voice?: VoiceId | null): Promise<ApiResult<CueResponse>>;
}

export interface CommandRunnerDeps {
  api: TourApi;
  audioSource(audio: NarrationAudio): RemoteSound | null;
  link: PlayerLink;
  cues: CueCache;
  visitedStore: VisitedStore;
  getSettings(): TourSettings;
  log(message: string, detail?: string): void;
}

/** `dispatch` must ignore results that arrive after the tour stopped or restarted. */
export type RunCommand = (command: TourCommand, dispatch: (event: TourEvent) => void) => void;

export function createCommandRunner(deps: CommandRunnerDeps): RunCommand {
  const { api, link, log } = deps;

  function fetchNearby(requestId: number, center: LatLng, radiusM: number, dispatch: (event: TourEvent) => void): void {
    api.getNearbyLandmarks(center, radiusM).then(
      (result) => {
        if (result.ok) dispatch({ type: 'NEARBY_RESULT', requestId, landmarks: result.data.landmarks });
        else {
          log('landmark search failed; retrying at the next check', result.error.code);
          dispatch({ type: 'NEARBY_FAILED', requestId });
        }
      },
      () => dispatch({ type: 'NEARBY_FAILED', requestId }),
    );
  }

  function fetchNarration(requestId: number, landmarkId: string, travelMode: TravelMode, dispatch: (event: TourEvent) => void): void {
    // Settings are read now, so a change applies to the next story.
    const { length, voice } = deps.getSettings();
    api.requestNarration({ landmarkId, length, travelMode, ...(voice ? { voice } : {}) }).then(
      (result) => {
        if (result.ok) dispatch({ type: 'NARRATION_READY', requestId, narration: result.data });
        else {
          log('story request failed; skipping it', result.error.code);
          dispatch({ type: 'NARRATION_FAILED', requestId });
        }
      },
      () => dispatch({ type: 'NARRATION_FAILED', requestId }),
    );
  }

  function play(command: Extract<TourCommand, { type: 'play' }>): void {
    const { narrationId, landmark, narration, side } = command;
    const intro = side ? deps.cues.introFor(side, deps.getSettings().voice) : undefined;
    link.play({
      id: narrationId,
      title: landmark.name,
      text: narration.text,
      audio: narration.audio ? deps.audioSource(narration.audio) : null,
      ...(intro ? { intro } : {}),
    });
  }

  return (command, dispatch) => {
    switch (command.type) {
      case 'fetchNearby':
        return fetchNearby(command.requestId, command.center, command.radiusM, dispatch);
      case 'fetchNarration':
      case 'prefetch':
        return fetchNarration(command.requestId, command.landmarkId, command.travelMode, dispatch);
      case 'play':
        return play(command);
      case 'stopPlayback':
        return link.stop();
      case 'pausePlayback':
        return link.pause();
      case 'resumePlayback':
        return link.resume();
      case 'saveVisited':
        return deps.visitedStore.save(command.day);
    }
  };
}
