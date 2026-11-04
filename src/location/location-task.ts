/**
 * The background location task. `TaskManager.defineTask` must run at module top level, so this
 * module has to be imported by the app entry (index.ts, through `@/tour/background-tasks`). While the app is
 * alive the task runs in the same JS runtime, so fixes go straight to the running tour.
 *
 * The task is shared by every tour, so each start claims it: only the newest claim may receive
 * fixes or stop the updates. A late answer from an older tour can then never stop a newer one.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { createLocationTaskHandler, type LocationTaskListener } from './location-task-handler';

export const LOCATION_TASK = 'wayfarer-tour-location';

/** Never rejects (nothing to stop is fine). */
export function stopLocationTaskUpdates(): Promise<void> {
  return Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
}

const handler = createLocationTaskHandler(() => {
  void stopLocationTaskUpdates();
});

let latestClaim = 0;

/** Takes the task for a new start (older claims lose it); fixes go to `listener`. Returns the claim. */
export function claimLocationTask(listener: LocationTaskListener): number {
  latestClaim += 1;
  handler.setListener(listener);
  return latestClaim;
}

/** True while no newer start has claimed the task. */
export function holdsLocationTask(claim: number): boolean {
  return claim === latestClaim;
}

/** Stops the updates, but only if this claim is still the newest. */
export function releaseLocationTask(claim: number): void {
  if (!holdsLocationTask(claim)) return;
  handler.setListener(null);
  void stopLocationTaskUpdates();
}

TaskManager.defineTask(LOCATION_TASK, async (body) => handler.handle(body));
