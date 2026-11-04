/**
 * Runs the notification's Pause / Resume / Stop buttons on the tour. Android delivers a button tap
 * to a TaskManager task while the app is off screen, and to the response listener while it is on
 * screen (sometimes to both: the responder runs each tap once). `defineTask` must run at module
 * top level, so this module is imported by the app entry (index.ts, through `@/tour/background-tasks`).
 */
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { tourLog } from '../dev-log';
import { isRunningStatus } from '../tour-snapshot';
import { tourSession } from '../tour-session';
import { createNotificationResponder } from './notification-commands';
import { dismissTourNotification } from './tour-notification';

export const TOUR_NOTIFICATION_TASK = 'wayfarer-tour-notification-action';

const respond = createNotificationResponder({
  pause: () => tourSession.pause(),
  resume: () => tourSession.resume(),
  end: () => tourSession.end(),
  isRunning: () => isRunningStatus(tourSession.getSnapshot().status),
  dismiss: () => {
    void dismissTourNotification();
  },
});

TaskManager.defineTask(TOUR_NOTIFICATION_TASK, async ({ data }) => respond(data));

if (Platform.OS === 'android') {
  Notifications.registerTaskAsync(TOUR_NOTIFICATION_TASK).catch((err: unknown) =>
    tourLog('could not register the notification task', String(err)),
  );
  Notifications.addNotificationResponseReceivedListener(respond);
}
