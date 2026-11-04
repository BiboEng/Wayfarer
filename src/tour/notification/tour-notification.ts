/**
 * The tour's control notification through expo-notifications: a silent low-importance channel,
 * one category per button set, and one fixed id so each update replaces the notification.
 * The location service's own notification can't have buttons; this one carries Pause / Stop.
 */
import * as Notifications from 'expo-notifications';

import {
  TOUR_CATEGORY_BUTTONS,
  TOUR_NOTIFICATION_ID,
  type TourNotificationCategory,
  type TourNotificationContent,
} from './notification-content';

const CHANNEL_ID = 'tour_controls';
const COLOR = '#C1693C';

let channelReady: Promise<void> | null = null;
let categoriesReady: Promise<void> | null = null;

/**
 * Creates the channel (Android 13 shows the permission prompt only once a channel exists).
 * Never rejects; a failure is retried on the next call.
 */
export function prepareTourChannel(): Promise<void> {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Tour controls',
    description: 'Pause or stop a running tour from the lock screen',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).then(
    () => undefined,
    () => {
      channelReady = null;
    },
  );
  return channelReady;
}

function prepareCategories(): Promise<void> {
  categoriesReady ??= Promise.all(
    (Object.keys(TOUR_CATEGORY_BUTTONS) as TourNotificationCategory[]).map((category) =>
      Notifications.setNotificationCategoryAsync(
        category,
        TOUR_CATEGORY_BUTTONS[category].map(({ identifier, title }) => ({
          identifier,
          buttonTitle: title,
          // Hands-free: the buttons act without opening the app.
          options: { opensAppToForeground: false },
        })),
      ),
    ),
  ).then(
    () => undefined,
    () => {
      categoriesReady = null;
    },
  );
  return categoriesReady;
}

/** Posts or replaces the notification. Rejects on failure (the caller logs it). */
export async function showTourNotification(content: TourNotificationContent): Promise<void> {
  await Promise.all([prepareTourChannel(), prepareCategories()]);
  await Notifications.scheduleNotificationAsync({
    identifier: TOUR_NOTIFICATION_ID,
    content: {
      title: content.title,
      body: content.body,
      categoryIdentifier: content.category,
      // Not sticky: a notification left behind by a killed app must still be swipeable. A tap on
      // the body opens the app without removing it. Swiped away mid-tour, it comes back with the
      // next change of status or place.
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      color: COLOR,
    },
    // Right away, on our silent channel.
    trigger: { channelId: CHANNEL_ID },
  });
}

/** Never rejects. */
export function dismissTourNotification(): Promise<void> {
  return Notifications.dismissNotificationAsync(TOUR_NOTIFICATION_ID).catch(() => undefined);
}

/**
 * Shows the tour notification while the app is on screen too (expo-notifications hides
 * notifications in the foreground unless a handler says otherwise): in the list only, silent.
 * Other notifications keep the default (not shown in the foreground).
 */
export function showTourNotificationInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowBanner: false,
      shouldShowList: notification.request.identifier === TOUR_NOTIFICATION_ID,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
