/**
 * What the tour's control notification says, and which buttons it has. Pure: no React or Expo
 * imports. Ids contain no ':' or '-' (expo-notifications categories break on them).
 */
import type { TourSnapshot } from '../types';

/** One fixed id: every update replaces the same notification. */
export const TOUR_NOTIFICATION_ID = 'wayfarer_tour_controls';

export type TourNotificationCategory = 'tour_playing' | 'tour_paused';

export const TOUR_ACTIONS = {
  pause: 'tour_pause',
  resume: 'tour_resume',
  stop: 'tour_stop',
} as const;

export type TourNotificationCommand = keyof typeof TOUR_ACTIONS;

export interface TourNotificationButton {
  identifier: (typeof TOUR_ACTIONS)[TourNotificationCommand];
  title: string;
}

export const TOUR_CATEGORY_BUTTONS: Record<TourNotificationCategory, TourNotificationButton[]> = {
  tour_playing: [
    { identifier: TOUR_ACTIONS.pause, title: 'Pause' },
    { identifier: TOUR_ACTIONS.stop, title: 'Stop' },
  ],
  tour_paused: [
    { identifier: TOUR_ACTIONS.resume, title: 'Resume' },
    { identifier: TOUR_ACTIONS.stop, title: 'Stop' },
  ],
};

export interface TourNotificationContent {
  title: string;
  body: string;
  category: TourNotificationCategory;
}

const TITLE = 'Wayfarer tour';

/** null = no tour running: no notification. */
export function notificationContentFor({ status, current }: Pick<TourSnapshot, 'status' | 'current'>): TourNotificationContent | null {
  switch (status) {
    case 'paused':
      return { title: TITLE, body: 'Paused', category: 'tour_paused' };
    case 'preparing':
    case 'narrating':
      if (current) return { title: TITLE, body: `Now: ${current.landmark.name}`, category: 'tour_playing' };
      return listening();
    case 'listening':
      return listening();
    default:
      return null;
  }
}

function listening(): TourNotificationContent {
  return { title: TITLE, body: 'Listening for places nearby', category: 'tour_playing' };
}

/** True when the notification would look the same, so it isn't posted again for nothing. */
export function sameNotificationContent(a: TourNotificationContent | null, b: TourNotificationContent | null): boolean {
  if (a === null || b === null) return a === b;
  return a.title === b.title && a.body === b.body && a.category === b.category;
}
