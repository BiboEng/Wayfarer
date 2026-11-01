/** Public types of the narration player. No React or Expo imports. */

export interface PlayableNarration {
  /** Caller-chosen id; the player state reports it so callers can tell whose state it is. */
  id: string;
  /** Landmark name (for lock-screen metadata later, Phase 6). */
  title: string;
  /** Text to speak on the device when there is no audio or the audio fails. */
  text: string;
  /** Server audio file (needs the headers), or null = speak `text` with the device voice. */
  audio: { uri: string; headers: Record<string, string> } | null;
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
