/**
 * What the background location task does with each batch: hands the newest position, as a fix,
 * to the one registered listener. Older positions in the same batch are dropped: a delayed batch
 * replayed fix by fix could cross a re-check distance several times and fire back-to-back
 * searches, and the newest fix carries its own speed and heading. A batch with nobody listening (after a crash, a JS
 * reload, or a headless start) means stray updates, so they are stopped.
 * Pure: the stop call is injected; expo-location is imported for its types only.
 */
import type { LocationObject } from 'expo-location';

import { toLocationFix } from './to-location-fix';
import type { FixListener, LocationErrorListener } from './types';

export interface LocationTaskListener {
  onFix: FixListener;
  onError?: LocationErrorListener;
}

/** The parts of a TaskManager task body this handler reads. */
export interface LocationTaskBody {
  data: unknown;
  error: { message: string } | null;
}

export interface LocationTaskHandler {
  /** Replaces the listener; null = nobody is listening (the next batch stops the updates). */
  setListener(listener: LocationTaskListener | null): void;
  handle(body: LocationTaskBody): void;
}

export function createLocationTaskHandler(stopUpdates: () => void): LocationTaskHandler {
  let listener: LocationTaskListener | null = null;

  return {
    setListener(next) {
      listener = next;
    },
    handle({ data, error }) {
      if (!listener) {
        stopUpdates();
        return;
      }
      if (error) {
        listener.onError?.(`location task error: ${error.message}`);
        return;
      }
      const newest = newestLocation(data);
      if (newest) listener.onFix(toLocationFix(newest));
    },
  };
}

/** The latest of the task's `data.locations`; null when there are none (malformed counts as none). */
function newestLocation(data: unknown): LocationObject | null {
  if (typeof data !== 'object' || data === null || !('locations' in data)) return null;
  const { locations } = data;
  if (!Array.isArray(locations)) return null;
  let newest: LocationObject | null = null;
  for (const location of locations.filter(isLocationObject)) {
    // Ties (or missing timestamps) go to the later entry: batches arrive oldest first.
    if (!newest || !(location.timestamp < newest.timestamp)) newest = location;
  }
  return newest;
}

function isLocationObject(value: unknown): value is LocationObject {
  if (typeof value !== 'object' || value === null || !('coords' in value)) return false;
  const { coords } = value;
  return typeof coords === 'object' && coords !== null && 'latitude' in coords && 'longitude' in coords;
}
