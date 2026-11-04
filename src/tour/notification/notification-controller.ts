/**
 * Keeps the control notification in step with the tour: posted when a tour runs, updated only
 * when its text or buttons change (status or current place), removed when the tour stops.
 * No React or Expo imports: the session and the notification calls are injected.
 */
import type { TourSession } from '../types';
import { notificationContentFor, sameNotificationContent, type TourNotificationContent } from './notification-content';

export interface NotificationControllerDeps {
  session: Pick<TourSession, 'getSnapshot' | 'subscribe'>;
  /** Posts or replaces the notification. May reject (logged, then ignored). */
  show(content: TourNotificationContent): Promise<void>;
  dismiss(): Promise<void>;
  log?: (message: string, detail?: string) => void;
}

/** Starts following the session; returns a function that stops following (and removes the notification). */
export function startNotificationController(deps: NotificationControllerDeps): () => void {
  let shown: TourNotificationContent | null = null;
  /** Calls run one after another, so a late "show" can never land after a "dismiss". */
  let queue: Promise<void> = Promise.resolve();

  function enqueue(call: () => Promise<void>): void {
    queue = queue.then(call).catch((err: unknown) => deps.log?.('tour notification failed', String(err)));
  }

  function update(): void {
    const next = notificationContentFor(deps.session.getSnapshot());
    if (sameNotificationContent(next, shown)) return;
    shown = next;
    if (next) enqueue(() => deps.show(next));
    else enqueue(() => deps.dismiss());
  }

  update();
  const unsubscribe = deps.session.subscribe(update);
  return () => {
    unsubscribe();
    if (shown) enqueue(() => deps.dismiss());
    shown = null;
  };
}
