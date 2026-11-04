/** Waits until the app is on screen again (React Native AppState). */
import { AppState } from 'react-native';

/** Resolves now if the app is on screen, otherwise the next time it comes back. Never rejects. */
export function whenAppForeground(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      subscription.remove();
      resolve();
    });
  });
}
