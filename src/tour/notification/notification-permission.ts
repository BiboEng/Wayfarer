/** Notification permission for the tour's lock-screen controls. Never rejects. */
import * as Notifications from 'expo-notifications';

import { prepareTourChannel } from './tour-notification';
import type { NotificationPermission } from './types';

/** Current permission, without prompting. If it can't be read, 'denied' (the tour starts anyway). */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  try {
    const response = await Notifications.getPermissionsAsync();
    if (response.granted) return 'granted';
    return response.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Shows the system prompt (call only from a user tap). Anything but a grant counts as refused. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    // Android 13+ only prompts once the app has a notification channel.
    await prepareTourChannel();
    const response = await Notifications.requestPermissionsAsync();
    return response.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
