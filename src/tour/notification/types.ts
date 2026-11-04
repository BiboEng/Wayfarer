/** Types of the tour's notification controls. No React or Expo imports. */

/**
 * Permission to show notifications. 'undetermined' also covers "refused once but the system can
 * still ask" (Android 13+); 'denied' means only the phone's Settings can change it.
 */
export type NotificationPermission = 'granted' | 'undetermined' | 'denied';

/** Notification access for the tour's start-up checks. Every method never rejects. */
export interface NotificationAccess {
  /** Current permission, without prompting. */
  getPermission(): Promise<NotificationPermission>;
  /** Shows the system prompt (call only from a user tap). */
  request(): Promise<NotificationPermission>;
  /** The user chose "continue without" (or refused the prompt) before. */
  wasDeclined(): Promise<boolean>;
  rememberDeclined(): Promise<void>;
}
