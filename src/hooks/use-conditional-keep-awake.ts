import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

const TAG = 'wayfarer-live-tour';

/** Keeps the screen on while `active` is true (hooks cannot be called conditionally, so this uses the imperative API). */
export function useConditionalKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    // A failed wake lock is not worth interrupting the tour for.
    activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [active]);
}
