/** When to search for landmarks again. Pure: no React or Expo imports. */
import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

/** After a failed search or story, the next check comes after this long even without moving. */
export const RETRY_AFTER_MS = 60_000;

/** True on the first fix (no check point yet), then after moving `everyM` from the last check point. */
export function shouldRecheck(lastCheckPoint: LatLng | null, position: LatLng, everyM: number): boolean {
  return lastCheckPoint === null || distanceMeters(lastCheckPoint, position) >= everyM;
}

/** A retry is scheduled (something failed) and its time has come. Successful searches schedule none. */
export function isRetryDue(retryDueAt: number | null, now: number): boolean {
  return retryDueAt !== null && now >= retryDueAt;
}
