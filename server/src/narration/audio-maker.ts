import type { VoiceId } from '@shared/narration/options';
import type { TTSProvider } from '@shared/narration/tts-provider';
import type { BlobStore } from '../cache/blob-store';
import type { DailyCaps } from '../costs/daily-caps';
import { UpstreamError } from '../http/upstream-error';

/** Voice name used when the server has no TTS voices. */
export const DEVICE_VOICE = 'device';

export interface AudioMakerDeps {
  blobs: BlobStore;
  tts: TTSProvider;
  caps: DailyCaps;
  log: (message: string) => void;
}

export interface AudioMaker {
  /** False when the provider has no voices ("none"): there is never server audio. */
  readonly hasVoices: boolean;
  /** The requested voice if the provider offers it, otherwise the default one. */
  resolveVoice(requested: VoiceId | undefined): VoiceId;
  /**
   * Makes the audio file for `text` and stores it under `blobKey`, within the daily TTS cap.
   * Concurrent calls for the same key share one paid call. Returns false for text-only.
   */
  ensure(blobKey: string, text: string, voice: VoiceId): Promise<boolean>;
}

/** A 4xx from the voice service came back before any audio was made, so nothing was billed. */
function failedBeforeSpending(err: unknown): boolean {
  return err instanceof UpstreamError && err.status !== undefined && err.status >= 400 && err.status < 500;
}

export function createAudioMaker(deps: AudioMakerDeps): AudioMaker {
  const { blobs, tts, caps, log } = deps;
  const hasVoices = tts.voices.length > 0;
  const flights = new Map<string, Promise<boolean>>();

  async function synthesizeAndStore(blobKey: string, text: string, voice: VoiceId): Promise<boolean> {
    const day = await caps.tryReserve('tts', text.length);
    if (day === null) return false;
    let audio;
    try {
      audio = await tts.synthesize(text, voice);
    } catch (err) {
      // Keep the reservation unless the call certainly never produced audio: a timeout or 5xx may still be billed.
      if (failedBeforeSpending(err)) await caps.release('tts', text.length, day);
      log(`[narration] TTS failed (${err instanceof Error ? err.name : 'error'}); returning text only.`);
      return false;
    }
    if (!audio) {
      await caps.release('tts', text.length, day);
      return false;
    }
    try {
      await blobs.put(blobKey, audio.data); // audio was paid for: the reservation stays
    } catch {
      log('[narration] Could not store audio; returning text only.');
      return false;
    }
    return true;
  }

  return {
    hasVoices,
    resolveVoice(requested) {
      if (!hasVoices) return DEVICE_VOICE;
      if (requested === undefined) return tts.voices[0].id;
      if (tts.voices.some((v) => v.id === requested)) return requested;
      // A voice saved in the app's Settings can outlive a change to ELEVENLABS_VOICES: a tour should still get a story.
      log('[narration] Unknown voice requested; using the default voice.'); // the id is client input, so it is not logged
      return tts.voices[0].id;
    },
    async ensure(blobKey, text, voice) {
      const running = flights.get(blobKey);
      if (running) return running;
      const promise = (async () => ((await blobs.has(blobKey)) ? true : synthesizeAndStore(blobKey, text, voice)))().finally(() =>
        flights.delete(blobKey),
      );
      flights.set(blobKey, promise);
      return promise;
    },
  };
}
