/**
 * Everything the Live Tour needs at app start, outside any screen. Imported by the app entry
 * (index.ts), before expo-router: TaskManager tasks must be defined at module top level, before
 * the first task event arrives (including when Android starts the JS bundle in the background).
 *
 * - the background location task (`@/location/location-task`)
 * - the notification button task and listener (`./notification/notification-actions`)
 * - the control notification following the tour (shown in the foreground too, silently)
 */
import { Platform } from 'react-native';

import '@/location/location-task';

import { tourLog } from './dev-log';
import './notification/notification-actions';
import { startNotificationController } from './notification/notification-controller';
import { dismissTourNotification, showTourNotification, showTourNotificationInForeground } from './notification/tour-notification';
import { tourSession } from './tour-session';

if (Platform.OS !== 'web') {
  showTourNotificationInForeground();
  startNotificationController({
    session: tourSession,
    show: showTourNotification,
    dismiss: dismissTourNotification,
    log: tourLog,
  });
}
