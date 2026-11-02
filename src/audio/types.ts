/** Public types of the narration player. No React or Expo imports. */

export interface PlayableNarration {
  /** Caller-chosen id; the player state reports it so callers can tell whose state it is. */
  id: string;
  /** Landmark name (for lock-screen metadata later, Phase 6). */
  title: string;
  /** Text to speak on the device when there is no audio or the audio fails. */
  text: string;
  /** Server audio file (needs the headers), or null = speak `text` with the device voice. */
  audio: RemoteSound | null;
  /**
   * A short line played right before the main part, as part of the same narration (same id,
   * one status; pause/resume/stop cover both; `ended` comes after the main part).
   * With main audio, the intro plays only from its own audio and is skipped if that is null or
   * fails. With the device voice, the device speaks the intro text first.
   */
  intro?: NarrationIntro;
}

export interface RemoteSound {
  uri: string;
  headers: Record<string, string>;
}

export interface NarrationIntro {
  text: string;
  audio: RemoteSound | null;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'failed';

export type PlayerOutput = 'audio' | 'device-voice';

export interface PlayerState {
  status: PlayerStatus;
  /** Id of the narration this state belongs to; null when idle after stop(). */
  narrationId: string | null;
  output: PlayerOutput | null;
}

export interface NarrationPlayer {
  /** Stops whatever is playing, then plays this one. Never two sounds at once. */
  play(narration: PlayableNarration): void;
  pause(): void;
  resume(): void;
  /** Stops and goes back to idle (narrationId null). */
  stop(): void;
  getState(): PlayerState;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}
