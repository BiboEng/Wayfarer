/**
 * The checks and prompts before a Live Tour starts: location permission, location services on,
 * then the notification controls. Only the request* methods show a system prompt (call them from
 * a user tap). Notifications never block the tour: a refusal or an error just starts it.
 * No React or Expo imports: everything is injected.
 */
import type { LocationPermission } from '@/location/types';

import type { NotificationAccess, NotificationPermission } from './notification/types';
import { phaseAfterPrompt, phaseForNotifications, phaseForPermission } from './permission-phase';
import type { SessionPhase } from './tour-snapshot';

export interface PermissionDeps {
  getPermission(): Promise<LocationPermission>;
  requestPermission(): Promise<LocationPermission>;
  servicesEnabled(): Promise<boolean>;
  /** Omit = no notification step. */
  notifications?: NotificationAccess;
}

/** What the flow needs from the session. */
export interface PermissionHost {
  phase(): SessionPhase;
  /** Bumped by the session on every start and stop. */
  generation(): number;
  setPhase(phase: SessionPhase): void;
  /** Stops the tour or a pending check before the location prompt. */
  cancel(): void;
  /** Runs the start checks again; `askNotifications` false skips the notification step. */
  restart(askNotifications: boolean): void;
}

/** The check was overtaken by a newer start or a stop: ignore its answer. */
export const STALE = 'stale';

export interface PermissionFlow {
  /** A system prompt is showing; a start must not discard its answer. */
  isAsking(): boolean;
  /** The waiting screen to show, null to start the tour, or STALE. */
  check(owner: number, askNotifications: boolean): Promise<SessionPhase | null | typeof STALE>;
  requestLocation(): void;
  requestNotifications(): void;
  skipNotifications(): void;
}

export function createPermissionFlow(deps: PermissionDeps, host: PermissionHost): PermissionFlow {
  let asking = false;

  /** Never rejects: if the answer can't be read, the tour starts without the notification step. */
  async function notificationPhase(): Promise<SessionPhase | null> {
    const access = deps.notifications;
    if (!access) return null;
    try {
      const [permission, declined] = await Promise.all([access.getPermission(), access.wasDeclined()]);
      return phaseForNotifications(permission, declined);
    } catch {
      return null;
    }
  }

  function rememberDeclined(): void {
    deps.notifications?.rememberDeclined().catch(() => undefined);
  }

  return {
    isAsking: () => asking,

    async check(owner, askNotifications) {
      const current = () => owner === host.generation();
      const waiting = phaseForPermission(await deps.getPermission());
      if (!current()) return STALE;
      if (waiting) return waiting;
      const enabled = await deps.servicesEnabled();
      if (!current()) return STALE;
      if (!enabled) return 'location-off';
      if (!askNotifications) return null;
      const notificationsWaiting = await notificationPhase();
      return current() ? notificationsWaiting : STALE;
    },

    requestLocation() {
      if (asking) return;
      asking = true;
      host.cancel();
      const owner = host.generation();
      const onAnswer = (permission: LocationPermission) => {
        asking = false;
        if (owner !== host.generation()) return;
        const waiting = phaseAfterPrompt(permission);
        if (waiting) host.setPhase(waiting);
        else host.restart(true);
      };
      deps.requestPermission().then(onAnswer, () => onAnswer('denied'));
    },

    requestNotifications() {
      const access = deps.notifications;
      if (asking || !access || host.phase() !== 'needs-notifications') return;
      asking = true;
      const owner = host.generation();
      const onAnswer = (permission: NotificationPermission) => {
        asking = false;
        // Refusing the prompt counts as "continue without": the explanation never comes back.
        if (permission !== 'granted') rememberDeclined();
        if (owner === host.generation()) host.restart(false);
      };
      access.request().then(onAnswer, () => onAnswer('denied'));
    },

    skipNotifications() {
      if (asking || host.phase() !== 'needs-notifications') return;
      rememberDeclined();
      host.restart(false);
    },
  };
}
