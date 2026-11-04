/** Which waiting screen a permission leads to. Pure: no React or Expo imports. */
import type { LocationPermission } from '@/location/types';

import type { NotificationPermission } from './notification/types';
import type { SessionPhase } from './tour-snapshot';

/** null = granted with precise location: the tour may start. */
export function phaseForPermission(permission: LocationPermission): SessionPhase | null {
  switch (permission) {
    case 'granted':
      return null;
    case 'approximate':
      return 'location-approximate';
    case 'undetermined':
      return 'needs-permission';
    case 'denied':
      return 'permission-denied';
  }
}

/** After the system prompt: a refusal shows the "Open settings" note, never the prompt again. */
export function phaseAfterPrompt(permission: LocationPermission): SessionPhase | null {
  return permission === 'undetermined' ? 'permission-denied' : phaseForPermission(permission);
}

/**
 * Notifications only add lock-screen controls, so they never block the tour: the explanation
 * shows only while the system can still ask and the user hasn't declined before.
 * null = start the tour.
 */
export function phaseForNotifications(permission: NotificationPermission, declinedBefore: boolean): SessionPhase | null {
  return permission === 'undetermined' && !declinedBefore ? 'needs-notifications' : null;
}
