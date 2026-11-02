import { loadSettings, saveSettings } from './settings-storage';
import { DEFAULT_SETTINGS, type SettingsStore, type TourSettings } from './types';

/** Creates a store that starts from the defaults, loads the saved values once, and saves each change. */
function createSettingsStore(): SettingsStore {
  let current: TourSettings = { ...DEFAULT_SETTINGS };
  // Fields changed before the saved copy arrived win over it.
  let changedEarly: Partial<TourSettings> = {};
  let loaded = false;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  void loadSettings().then((saved) => {
    loaded = true;
    const hadEarlyChanges = Object.keys(changedEarly).length > 0;
    current = { ...saved, ...changedEarly };
    changedEarly = {};
    notify();
    if (hadEarlyChanges) void saveSettings(current);
  });

  return {
    get: () => current,
    set(patch) {
      if (!loaded) changedEarly = { ...changedEarly, ...patch };
      current = { ...current, ...patch };
      notify();
      // Before the saved copy has loaded, saving would overwrite it with defaults; saved after loading.
      if (loaded) void saveSettings(current);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const settingsStore: SettingsStore = createSettingsStore();
