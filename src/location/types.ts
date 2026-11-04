/** Location types shared by real GPS and the route simulator. No React or Expo imports. */

/** One position update, from GPS or the simulator. */
export interface LocationFix {
  lat: number;
  lng: number;
  /** Radius of uncertainty in meters (Infinity when unknown). */
  accuracyM: number;
  /** Instantaneous speed in m/s, null when the source doesn't report it. */
  speedMps: number | null;
  /** Direction of travel reported by the source (0 = north), null when unknown. */
  headingDeg: number | null;
  /** Epoch milliseconds. */
  timestamp: number;
}

/**
 * Foreground location permission. 'undetermined' also covers "refused once but the system can
 * still ask" (Android), so the explanation screen can offer the prompt again; 'denied' means only
 * the phone's Settings can fix it. 'approximate': granted, but only approximate location
 * (Android 12+ "Approximate", iOS "Precise: off"); too coarse for the tour, so it never tracks.
 */
export type LocationPermission = 'granted' | 'approximate' | 'undetermined' | 'denied';

/** Our own accuracy levels, mapped to the platform's in the adapter. */
export type TrackingAccuracy = 'balanced' | 'high';

export interface TrackingOptions {
  accuracy: TrackingAccuracy;
  /** Only report after moving at least this far. */
  distanceIntervalM: number;
  /** At most one update per this many milliseconds (Android). */
  timeIntervalMs: number;
}

export type FixListener = (fix: LocationFix) => void;
/** Watch errors are reported, never thrown; the caller decides (the tour just logs in dev). */
export type LocationErrorListener = (message: string) => void;

/** Real GPS and the simulated routes both implement this, so they feed the same pipeline. */
export interface LocationSource {
  /** Starts watching. Calling start again replaces the previous watch. */
  start(options: TrackingOptions, onFix: FixListener, onError?: LocationErrorListener): void;
  /** Applies new options to a running watch (restarting it if needed). No-op when stopped. */
  setOptions(options: TrackingOptions): void;
  /** Stops for good; no more fixes after this. */
  stop(): void;
}

/**
 * Location updates that keep coming with the screen off (an Android foreground service).
 * Unlike LocationSource, start and setOptions report whether the system accepted them.
 */
export interface BackgroundLocationSource {
  /** Resolves once updates run; rejects when the system refuses (nothing is left running then). */
  start(options: TrackingOptions, onFix: FixListener, onError?: LocationErrorListener): Promise<void>;
  /** Re-applies options to running updates; rejects when refused (the old options keep running). */
  setOptions(options: TrackingOptions): Promise<void>;
  /** Stops for good; no more fixes after this. */
  stop(): void;
}
