/** The small internal interface both sound outputs (audio file, device voice) implement. */

export interface PlaybackCallbacks {
  /** Sound has actually started (called once). */
  onStarted(): void;
  /** Played to the end. */
  onFinished(): void;
  /** Could not load, start, or keep playing. */
  onError(): void;
  /** The system paused (true) or resumed (false) playback by itself: audio focus, app in background. */
  onInterrupted(paused: boolean): void;
}

export interface PlaybackOutput {
  pause(): void;
  resume(): void;
  /** Stops for good and frees resources. After this the output makes no sound and calls no callbacks. */
  stop(): void;
}

export type StartAudioFile = (source: { uri: string; headers: Record<string, string> }, callbacks: PlaybackCallbacks) => PlaybackOutput;

export type StartDeviceVoice = (text: string, callbacks: PlaybackCallbacks) => PlaybackOutput;
