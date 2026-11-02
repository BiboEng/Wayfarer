/** Public types of the Live Tour session: what the Live Tour screen renders and calls. No React or Expo imports. */
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import type { OrientationCue } from '@shared/narration/cues';
import type { TravelMode } from '@shared/narration/options';

export type TourStatus =
  /** No tour running. */
  | 'idle'
  /** Location permission not asked yet: show the explanation, then call requestPermission(). */
  | 'needs-permission'
  /** The user refused location: show a short note and an "Open settings" button. */
  | 'permission-denied'
  /** Location services are switched off on the phone. */
  | 'location-off'
  /** Only approximate location was allowed (Android 12+): too coarse for a tour. Ask for precise location. */
  | 'location-approximate'
  /** Tracking; nothing being narrated right now (also when nothing notable is nearby). */
  | 'listening'
  /** A landmark was picked and its story is being fetched. */
  | 'preparing'
  | 'narrating'
  | 'paused';

/** Where the landmark is relative to the direction of travel. */
export type Side = OrientationCue;

export type TourSource = 'gps' | 'sim-walk' | 'sim-drive';

export interface CurrentNarration {
  landmark: Landmark;
  /** null when there is no reliable heading or the place is very close. */
  side: Side | null;
  /** The story text; empty while status is 'preparing'. */
  text: string;
}

export interface NarratedPlace {
  landmark: Landmark;
  /** Epoch milliseconds. */
  narratedAt: number;
}

export interface TourSnapshot {
  status: TourStatus;
  mode: TravelMode;
  /** true when Settings fixes the mode; false when it is detected from speed. */
  modeFixed: boolean;
  source: TourSource;
  position: LatLng | null;
  /** Direction of travel in degrees (0 = north), null when not moving enough to tell. */
  headingDeg: number | null;
  /** The latest search results, for the mini map. */
  nearby: Landmark[];
  current: CurrentNarration | null;
  /** Places narrated in this tour, newest first. */
  history: NarratedPlace[];
}

export interface TourSession {
  /** Starts tracking (asks nothing: status becomes 'needs-permission' if permission is missing). */
  start(source?: TourSource): void;
  /** Shows the system location prompt, then starts if granted. Call only from a user tap. */
  requestPermission(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  /** Ends the current story and moves on to the next place. */
  skip(): void;
  /** Plays a place from `history` again, now. */
  replay(landmarkId: string): void;
  getSnapshot(): TourSnapshot;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}
