/** Remembers in AsyncStorage that the user declined notifications. Never rejects. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'wayfarer.tour.notifications-declined.v1';

export const notificationChoice = {
  /** false when nothing is stored or storage fails (the explanation may show once more). */
  async wasDeclined(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
    } catch {
      return false;
    }
  },
  async rememberDeclined(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Not remembered: the explanation may show once more. Never blocks the tour.
    }
  },
};
