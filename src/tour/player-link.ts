/**
 * The tour's handle on the shared narration player. It remembers which narration id is the
 * tour's, reports only that one's end, and never stops or pauses anyone else's sound.
 * No React or Expo imports: the player is injected.
 */
import type { NarrationPlayer, PlayableNarration } from '@/audio/types';

export interface PlayerLink {
  /**
   * Starts listening to the player. `onEnded` fires once per tour story: ended, replaced by
   * someone else, or failed (`failed` true: it could not be played, even by the device voice).
   */
  connect(onEnded: (narrationId: string, failed: boolean) => void, onChange: () => void): void;
  disconnect(): void;
  /** Plays a tour story (the player replaces whatever was playing). */
  play(narration: PlayableNarration): void;
  /** Stops the tour's story, if the player still has it. */
  stop(): void;
  pause(): void;
  resume(): void;
  /** The tour's story is paused in the player (by the user or the system). */
  isPaused(): boolean;
}

export function createPlayerLink(player: NarrationPlayer): PlayerLink {
  /** The tour narration the player is (or should be) playing; null when none. */
  let ownedId: string | null = null;
  let unsubscribe: (() => void) | null = null;
  const ours = () => ownedId !== null && player.getState().narrationId === ownedId;

  return {
    connect(onEnded, onChange) {
      unsubscribe?.();
      unsubscribe = player.subscribe(() => {
        const id = ownedId;
        if (id !== null) {
          const { narrationId, status } = player.getState();
          // Ended, failed or replaced by someone else: the story is done either way.
          if (narrationId !== id || status === 'ended' || status === 'failed') {
            ownedId = null;
            onEnded(id, narrationId === id && status === 'failed');
            return;
          }
        }
        onChange();
      });
    },
    disconnect() {
      unsubscribe?.();
      unsubscribe = null;
    },
    play(narration) {
      // Set first: the player's synchronous update must not read as "our previous story ended".
      ownedId = narration.id;
      player.play(narration);
    },
    stop() {
      const mine = ours();
      ownedId = null;
      if (mine) player.stop();
    },
    pause() {
      if (ours()) player.pause();
    },
    resume() {
      if (ours()) player.resume();
    },
    isPaused() {
      return ours() && player.getState().status === 'paused';
    },
  };
}
