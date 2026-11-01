/**
 * Speaks narration text with the device voice (expo-speech), one chunk after another.
 * Android has no Speech.pause, so pause = stop and remember the chunk; resume restarts that chunk.
 */
import * as Speech from 'expo-speech';

import { devLog } from './dev-log';
import type { PlaybackCallbacks, PlaybackOutput, StartDeviceVoice } from './playback-output';
import { toSpeechChunks } from './speech-chunks';

/** Short chunks so resume restarts close to where it paused (~2-3 sentences). */
const PREFERRED_CHUNK_LENGTH = 300;
/** Each chunk must start speaking by then (Android's speak() can fail without a callback). */
const START_TIMEOUT_MS = 15_000;

export const startDeviceVoice: StartDeviceVoice = (text, callbacks) => new DeviceVoiceOutput(text, callbacks);

class DeviceVoiceOutput implements PlaybackOutput {
  private readonly chunks: string[];
  private index = 0;
  /** Only callbacks from this utterance count; bumping it silences ones we stopped ourselves. */
  private utterance = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private paused = false;
  /** Stopped, finished or failed: no more sound, no more callbacks. */
  private done = false;

  constructor(
    text: string,
    private readonly callbacks: PlaybackCallbacks,
  ) {
    this.chunks = toSpeechChunks(text, Math.min(Speech.maxSpeechInputLength, PREFERRED_CHUNK_LENGTH));
    if (this.chunks.length === 0) {
      // Callbacks must never fire synchronously from start.
      setTimeout(() => this.fail('has nothing to say'), 0);
      return;
    }
    this.speakCurrent();
  }

  pause(): void {
    if (this.done || this.paused) return;
    this.paused = true;
    this.silence();
  }

  resume(): void {
    if (this.done || !this.paused) return;
    this.paused = false;
    this.speakCurrent();
  }

  stop(): void {
    if (this.done) return;
    this.done = true;
    this.silence();
  }

  private speakCurrent(): void {
    const id = ++this.utterance;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (id === this.utterance) this.fail('did not start in time');
    }, START_TIMEOUT_MS);

    try {
      Speech.speak(this.chunks[this.index], {
        language: 'en',
        onStart: () => {
          if (id === this.utterance) this.onStart();
        },
        onDone: () => {
          if (id === this.utterance) this.onChunkDone();
        },
        onError: (err) => {
          if (id === this.utterance) this.fail('error', err.message);
        },
      });
    } catch (err) {
      setTimeout(() => {
        if (id === this.utterance) this.fail('could not speak', String(err));
      }, 0);
    }
  }

  private onStart(): void {
    clearTimeout(this.timer);
    if (this.started) return;
    this.started = true;
    this.callbacks.onStarted();
  }

  private onChunkDone(): void {
    this.index += 1;
    if (this.index < this.chunks.length) {
      this.speakCurrent();
      return;
    }
    this.done = true;
    this.utterance += 1;
    clearTimeout(this.timer);
    this.callbacks.onFinished();
  }

  private fail(reason: string, detail?: string): void {
    if (this.done) return;
    devLog(`device voice ${reason}`, detail);
    this.done = true;
    this.silence();
    this.callbacks.onError();
  }

  /** Ignores every callback of the current utterance, then stops the engine. */
  private silence(): void {
    this.utterance += 1;
    clearTimeout(this.timer);
    Speech.stop().catch((err: unknown) => devLog('could not stop the device voice', String(err)));
  }
}
