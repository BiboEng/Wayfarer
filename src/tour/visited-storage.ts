/** Saves today's visited list in AsyncStorage. Every failure is ignored (the tour carries on). */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseVisitedDay, type VisitedDay } from './visited';

const STORAGE_KEY = 'wayfarer.tour.visited.v1';

export interface VisitedStore {
  /** The stored list, or null (nothing stored, unreadable, or storage failed). Never rejects. */
  load(): Promise<VisitedDay | null>;
  /** Fire and forget. */
  save(day: VisitedDay): void;
}

export const asyncStorageVisitedStore: VisitedStore = {
  async load() {
    try {
      return parseVisitedDay(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  },
  save(day) {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(day)).catch(() => undefined);
  },
};
