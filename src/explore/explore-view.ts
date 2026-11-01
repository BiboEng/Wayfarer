import type { Landmark } from '@shared/landmarks/landmark';

/** Which voice is speaking: the server's audio file or the phone's own voice. */
export type NarrationOutput = 'audio' | 'device-voice';

/** The story part of the Explore card. */
export type NarrationView =
  /** The server is writing the story (up to ~45 s on a cache miss). */
  | { status: 'writing' }
  /** The story arrived; the player is loading the audio. */
  | { status: 'starting'; text: string }
  | { status: 'playing' | 'paused'; output: NarrationOutput; text: string }
  /** Finished, or stopped by the user. Replay is possible. */
  | { status: 'ended'; text: string }
  /**
   * No story to play. `text` is set when the story arrived but could not be
   * played; `retryable` is false when trying again would not help.
   */
  | { status: 'unavailable'; message: string; retryable: boolean; text?: string };

/** Everything the Explore bottom card shows. */
export type ExploreView =
  /** Nothing tapped yet. */
  | { kind: 'hint' }
  | { kind: 'searching' }
  /** No notable landmark within the widest search step. */
  | { kind: 'nothing'; radiusKm: number }
  /** The search failed (server unreachable, timeout...). Retry is possible. */
  | { kind: 'error'; message: string }
  | {
      kind: 'landmark';
      landmark: Landmark;
      /** From the tapped point to the landmark. */
      distanceMeters: number;
      narration: NarrationView;
    };
