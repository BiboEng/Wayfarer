/** State, events and commands of the Live Tour reducer. Pure types: no React or Expo imports. */
import type { NarrationResponse } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import type { TravelMode } from '@shared/narration/options';

import type { NarratedPlace, Side } from './types';
import type { VisitedDay } from './visited';

/** The one story the tour is working on. There is never more than one. */
export type CurrentStory =
  /** Its narration is being requested. `replay`: a history item the user asked for again. */
  | { phase: 'fetching'; landmark: Landmark; side: Side | null; requestId: number; replay: boolean }
  /** The narration arrived while paused; it plays on resume. */
  | { phase: 'ready'; landmark: Landmark; side: Side | null; narration: NarrationResponse; replay: boolean }
  /** Handed to the player as `narrationId`; the next story waits for its end. */
  | { phase: 'playing'; landmark: Landmark; side: Side | null; narration: NarrationResponse; narrationId: string };

/** The next likely story, requested while the current one plays (at most one). */
export interface Prefetch {
  landmark: Landmark;
  requestId: number;
  /** null while the request is in flight. */
  narration: NarrationResponse | null;
}

export interface TourMachineState {
  /** Time of the latest fix (epoch ms). */
  now: number;
  mode: TravelMode;
  position: LatLng | null;
  headingDeg: number | null;
  /** Where the last landmark search was made; null = search on the next fix. */
  lastCheckAt: LatLng | null;
  /** When the last search was made (epoch ms); null before the first. */
  lastCheckTime: number | null;
  /**
   * Something failed (a search, a story request, playback): the next check is due at this time
   * even without moving. null when nothing failed (successful searches are distance-only).
   */
  retryDueAt: number | null;
  /** Id of the search in flight; results with another id are stale. */
  nearbyRequestId: number | null;
  /** The latest search results. */
  nearby: Landmark[];
  /** Today's visited list; null until loaded from storage (nothing is picked before that). */
  visited: VisitedDay | null;
  /** Narrated or skipped in this tour: never picked again, whatever the date. */
  tourIds: string[];
  /** Requests that failed since the last search; retried after the next one. */
  failedIds: string[];
  /** A story request failed: pick nothing new until the next search (no bursts of failing requests). */
  holdUntilCheck: boolean;
  /** Places narrated in this tour, newest first. */
  history: NarratedPlace[];
  /** Every narration received in this tour, by landmark id (replay and pre-fetch use them). */
  stories: Record<string, NarrationResponse>;
  /**
   * Story requests still on their way, landmark id → request id, even ones no longer wanted.
   * A place with one is never requested again; the request is adopted if it is wanted again.
   */
  storyRequests: Record<string, number>;
  current: CurrentStory | null;
  prefetch: Prefetch | null;
  /** The user paused: hold the queue. */
  paused: boolean;
  nextRequestId: number;
  /** Number of play commands issued; makes every narration id unique. */
  playCount: number;
}

export type TourEvent =
  | { type: 'FIX'; position: LatLng; headingDeg: number | null; mode: TravelMode; now: number }
  | { type: 'VISITED_LOADED'; day: VisitedDay | null; today: string }
  | { type: 'NEARBY_RESULT'; requestId: number; landmarks: Landmark[] }
  | { type: 'NEARBY_FAILED'; requestId: number }
  | { type: 'NARRATION_READY'; requestId: number; narration: NarrationResponse }
  | { type: 'NARRATION_FAILED'; requestId: number }
  /** The player finished the narration with this id. `failed`: it could not be played at all. */
  | { type: 'PLAYBACK_ENDED'; narrationId: string; failed?: boolean }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SKIP' }
  | { type: 'REPLAY'; landmarkId: string };

export type TourCommand =
  | { type: 'fetchNearby'; requestId: number; center: LatLng; radiusM: number }
  | { type: 'fetchNarration'; requestId: number; landmarkId: string; travelMode: TravelMode }
  | { type: 'prefetch'; requestId: number; landmarkId: string; travelMode: TravelMode }
  | { type: 'play'; narrationId: string; landmark: Landmark; narration: NarrationResponse; side: Side | null }
  | { type: 'stopPlayback' }
  | { type: 'pausePlayback' }
  | { type: 'resumePlayback' }
  | { type: 'saveVisited'; day: VisitedDay };

export interface TourStep {
  state: TourMachineState;
  commands: TourCommand[];
}
