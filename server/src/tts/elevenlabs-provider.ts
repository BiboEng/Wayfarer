import type { SynthesizedAudio, TTSProvider, VoiceOption } from '@shared/narration/tts-provider';
import { withTimeout } from '../http/timeout-signal';
import { UpstreamError } from '../http/upstream-error';

export interface ElevenLabsOptions {
  apiKey: string;
  /** First voice is the default. */
  voices: VoiceOption[];
  /** Flash v2.5 costs half as much per character as Multilingual v2. */
  modelId?: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

const UPSTREAM = 'elevenlabs';

/** ElevenLabs text-to-speech over built-in fetch. Returns MP3. Never logs keys or bodies. */
export function createElevenLabsProvider(options: ElevenLabsOptions): TTSProvider {
  const fetchFn = options.fetchFn ?? fetch;
  const base = options.baseUrl ?? 'https://api.elevenlabs.io';
  const modelId = options.modelId ?? 'eleven_flash_v2_5';
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    name: 'elevenlabs',
    voices: options.voices,
    async synthesize(text, voice, signal): Promise<SynthesizedAudio> {
      // Only voices from our own config are ever put in the URL.
      if (!options.voices.some((v) => v.id === voice)) throw new UpstreamError(UPSTREAM, 'unknown voice');
      const url = `${base}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`;
      let res: Response;
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { 'xi-api-key': options.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: modelId }),
          signal: withTimeout(timeoutMs, signal),
        });
      } catch (err) {
        if (signal?.aborted) throw err;
        throw new UpstreamError(UPSTREAM, err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'network error');
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new UpstreamError(UPSTREAM, `HTTP ${res.status}`, res.status);
      }
      let data: Uint8Array;
      try {
        data = new Uint8Array(await res.arrayBuffer());
      } catch {
        throw new UpstreamError(UPSTREAM, 'could not read audio');
      }
      if (data.byteLength === 0) throw new UpstreamError(UPSTREAM, 'empty audio');
      return { contentType: 'audio/mpeg', data };
    },
  };
}
