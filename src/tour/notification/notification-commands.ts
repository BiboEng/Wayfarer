/**
 * Turns a tap on a notification button into a tour command. The same tap can arrive twice (the
 * background task and the response listener both see it), so each one runs once. A button on a
 * notification with no tour behind it (left over after the app was killed) just removes it.
 * Pure: no React or Expo imports; payloads are read defensively.
 */
import { TOUR_ACTIONS, TOUR_NOTIFICATION_ID, type TourNotificationCommand } from './notification-content';

export interface TourControls {
  pause(): void;
  resume(): void;
  /** Ends the tour (status 'ended'). */
  end(): void;
  isRunning(): boolean;
  /** Removes the tour notification. Fire and forget. */
  dismiss(): void;
}

interface ButtonTap {
  command: TourNotificationCommand;
  /** Same tap, same key. */
  key: string;
}

/** Enough to tell repeats apart: later taps come from a re-posted notification (new date). */
const REMEMBERED_TAPS = 20;

/** Returns the function to call with every notification response (task payload or listener event). */
export function createNotificationResponder(controls: TourControls): (payload: unknown) => void {
  const seen: string[] = [];

  return (payload) => {
    const tap = readButtonTap(payload);
    if (!tap || seen.includes(tap.key)) return;
    seen.push(tap.key);
    if (seen.length > REMEMBERED_TAPS) seen.shift();

    if (!controls.isRunning()) {
      controls.dismiss();
      return;
    }
    if (tap.command === 'pause') controls.pause();
    else if (tap.command === 'resume') controls.resume();
    else controls.end();
  };
}

/** A tap on one of our buttons; null for anything else (a tap on the body, other notifications). */
export function readButtonTap(payload: unknown): ButtonTap | null {
  if (!isObject(payload) || typeof payload.actionIdentifier !== 'string') return null;
  const command = commandFor(payload.actionIdentifier);
  const notification = payload.notification;
  if (!command || !isObject(notification)) return null;
  const request = notification.request;
  if (!isObject(request) || request.identifier !== TOUR_NOTIFICATION_ID) return null;
  const date = typeof notification.date === 'number' ? notification.date : 0;
  return { command, key: `${payload.actionIdentifier}@${date}` };
}

function commandFor(actionIdentifier: string): TourNotificationCommand | null {
  const entry = Object.entries(TOUR_ACTIONS).find(([, id]) => id === actionIdentifier);
  return entry ? (entry[0] as TourNotificationCommand) : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
