/**
 * Plays a server audio file with expo-audio. One player per narration; released when done.
 * Uses `createAudioPlayer` (not the hook) because the narration player outlives any screen.
 */
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import { devLog } from './dev-log';
import type { PlaybackCallbacks, PlaybackOutput, StartAudioFile } from './playback-output';

/** If the file hasn't started playing by then, give up and let the device voice speak. */
const START_TIMEOUT_MS = 15_000;
/** Status updates while playing; only finish/error/play-state matter, so keep them sparse. */
const STATUS_INTERVAL_MS = 1_000;
/** `AudioStatus.playbackState` at end of media on Android (`playbackStateToString` in AudioPlayer.kt). */
const ENDED_STATE = 'ended';

export const startAudioFile: StartAudioFile = (source, callbacks) => new AudioFileOutput(source, callbacks);

class AudioFileOutput implements PlaybackOutput {
  private player: AudioPlayer | null = null;
  private subscription: { remove(): void } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Stopped, finished or failed: no more sound, no more callbacks. */
  private done = false;
  private started = false;
  /** What the user wants: false after pause(), true after start/resume(). */
  private wantPlaying = true;
  /** play() was called and `playing: true` hasn't been seen since, so `playing: false` is expected. */
  private awaitingPlay = true;
  /** The system paused us (audio focus lost, app in background). */
  private interrupted = false;

  constructor(
    source: { uri: string; headers: Record<string, string> },
    private readonly callbacks: PlaybackCallbacks,
  ) {
    this.timer = setTimeout(() => this.fail('did not start in time'), START_TIMEOUT_MS);
    try {
      const player = createAudioPlayer({ uri: source.uri, headers: source.headers }, { updateInterval: STATUS_INTERVAL_MS });
      this.player = player;
      this.subscription = player.addListener('playbackStatusUpdate', (status) => this.onStatus(status));
      player.play();
    } catch (err) {
      // Callbacks must never fire synchronously from start.
      setTimeout(() => this.fail('could not be created', String(err)), 0);
    }
  }

  pause(): void {
    if (this.done || !this.wantPlaying) return;
    this.wantPlaying = false;
    this.player?.pause();
  }

  resume(): void {
    if (this.done) return;
    this.wantPlaying = true;
    this.awaitingPlay = true;
    this.interrupted = false;
    this.player?.play();
  }

  stop(): void {
    this.done = true;
    this.release();
  }

  private onStatus(status: AudioStatus): void {
    if (this.done) return;
    if (status.error) {
      this.fail('playback error', status.error);
      return;
    }
    // End of media. Android may send `playing: false` with `playbackState: 'ended'` before the
    // `didJustFinish` update; that is the end, not an interruption. (iOS has no 'ended' state and
    // relies on `didJustFinish`.) `finish` sets `done`, so this reports once.
    if (status.didJustFinish || status.playbackState === ENDED_STATE) {
      this.finish(() => this.callbacks.onFinished());
      return;
    }
    if (status.playing) this.onPlaying();
    else if (this.started && this.wantPlaying && !this.awaitingPlay && !this.interrupted) {
      this.interrupted = true;
      this.callbacks.onInterrupted(true);
    }
  }

  private onPlaying(): void {
    if (!this.wantPlaying) {
      // The system resumed a sound the user had paused; keep it paused.
      this.player?.pause();
      return;
    }
    this.awaitingPlay = false;
    if (!this.started) {
      this.started = true;
      clearTimeout(this.timer);
      this.callbacks.onStarted();
    } else if (this.interrupted) {
      this.interrupted = false;
      this.callbacks.onInterrupted(false);
    }
  }

  private fail(reason: string, detail?: string): void {
    if (this.done) return;
    devLog(`audio file ${reason}; falling back to the device voice`, detail);
    this.finish(() => this.callbacks.onError());
  }

  private finish(notify: () => void): void {
    this.done = true;
    this.release();
    notify();
  }

  private release(): void {
    clearTimeout(this.timer);
    this.subscription?.remove();
    this.subscription = null;
    const player = this.player;
    this.player = null;
    if (!player) return;
    try {
      player.pause();
      player.release();
    } catch (err) {
      devLog('could not release the audio player', String(err));
    }
  }
}
