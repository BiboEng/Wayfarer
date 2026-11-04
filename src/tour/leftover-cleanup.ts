/**
 * After a crash or a JS reload, the location updates and the control notification can outlive the
 * tour that started them. This stops them when no tour is running.
 * No React or Expo imports: everything is injected.
 */
export interface LeftoverDeps {
  isTourRunning(): boolean;
  hasStartedUpdates(): Promise<boolean>;
  stopUpdates(): Promise<void>;
  dismissNotification(): Promise<void>;
}

/** Never rejects. */
export async function cleanUpLeftovers(deps: LeftoverDeps): Promise<void> {
  if (deps.isTourRunning()) return;
  try {
    await deps.dismissNotification();
    const started = await deps.hasStartedUpdates();
    // Checked again: a tour may have started while we were asking.
    if (started && !deps.isTourRunning()) await deps.stopUpdates();
  } catch {
    // Nothing left to do; a stray location batch stops the updates by itself.
  }
}
