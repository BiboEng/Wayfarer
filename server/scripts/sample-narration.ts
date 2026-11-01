/**
 * Narrates one landmark through the real pipeline and prints what came out. Run by hand, from server/:
 *
 *   npx tsx scripts/sample-narration.ts [landmarkId] [walking|driving] [short|medium|long]
 *
 * Defaults: wiki:42764 (Hagia Sophia), walking, medium. Reads server/.env like the server does.
 * Spends real money (one OpenRouter call, and ElevenLabs characters when TTS_PROVIDER=elevenlabs),
 * so it is not part of `npm test`. A second run is a cache hit and costs nothing when CACHE_PATH is set.
 * Never prints keys. Writes server/sample.mp3 when the voice provider returned audio.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NARRATION_LENGTHS, TRAVEL_MODES, type NarrationLength, type TravelMode } from '@shared/narration/options';
import { targetWords } from '@shared/narration/length';
import { createBlobStore } from '../src/cache/create-blob-store';
import { createCacheStore } from '../src/cache/create-cache-store';
import { EnvError, parseEnv } from '../src/config/env';
import { loadEnvFile } from '../src/config/load-env-file';
import { createDailyCaps } from '../src/costs/daily-caps';
import { createLandmarkService } from '../src/landmarks';
import { createNarrator } from '../src/narration/narrate';
import { NarrationError } from '../src/narration/narration-error';
import { createOpenRouterClient, type LlmClient, type LlmResult } from '../src/narration/openrouter-client';
import { createTtsProvider } from '../src/tts/create-tts-provider';

const DEFAULT_LANDMARK = 'wiki:42764'; // Hagia Sophia
const OUTPUT_FILE = fileURLToPath(new URL('../sample.mp3', import.meta.url));

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  if (value === undefined) return fallback;
  const found = allowed.find((a) => a === value);
  if (!found) {
    console.error(`Unknown ${name} "${value}". Use one of: ${allowed.join(', ')}.`);
    process.exit(2);
  }
  return found;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

async function main(): Promise<void> {
  const [idArg, modeArg, lengthArg] = process.argv.slice(2);
  const landmarkId = idArg ?? DEFAULT_LANDMARK;
  const travelMode: TravelMode = pick(modeArg, TRAVEL_MODES, 'walking', 'travel mode');
  const length: NarrationLength = pick(lengthArg, NARRATION_LENGTHS, 'medium', 'length');

  loadEnvFile();
  const config = parseEnv(process.env); // throws EnvError naming the bad variables, never their values

  const cache = createCacheStore(config.cachePath);
  const blobs = createBlobStore(config.audioDir);
  const tts = createTtsProvider(config);
  const landmarks = createLandmarkService({ contact: config.contact, overpassUrl: config.overpassUrl, cache });

  // Remember what the model reported (model name, tokens, cost) and what the voice was asked to say.
  const openRouter = createOpenRouterClient({ apiKey: config.openRouterApiKey, model: config.openRouterModel });
  let lastLlm: LlmResult | undefined;
  const llm: LlmClient = {
    async complete(messages, maxTokens, signal) {
      lastLlm = await openRouter.complete(messages, maxTokens, signal);
      return lastLlm;
    },
  };
  let ttsCharacters = 0;
  const countingTts = {
    ...tts,
    async synthesize(...args: Parameters<typeof tts.synthesize>) {
      const audio = await tts.synthesize(...args);
      if (audio) ttsCharacters += args[0].length;
      return audio;
    },
  };

  const narrator = createNarrator({
    cache,
    blobs,
    landmarks,
    llm,
    tts: countingTts,
    caps: createDailyCaps({ cache, llmCalls: config.dailyLlmCallCap, ttsChars: config.dailyTtsCharCap }),
  });

  console.log(`Narrating ${landmarkId} (${travelMode}, ${length}) with TTS provider "${tts.name}"...`);
  const started = Date.now();
  try {
    const result = await narrator.narrate({ landmarkId, travelMode, length });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const target = targetWords(travelMode, length);

    console.log(`\n${result.text}\n`);
    console.log(`Words:        ${wordCount(result.text)} (target ${target})`);
    console.log(`Source:       ${result.source}`);
    if (lastLlm) {
      const cost = lastLlm.costUsd === undefined ? 'not reported' : `$${lastLlm.costUsd}`;
      console.log(`Model:        ${lastLlm.model}`);
      console.log(`Tokens:       ${lastLlm.promptTokens ?? '?'} in, ${lastLlm.completionTokens ?? '?'} out`);
      console.log(`AI cost:      ${cost} (as reported by OpenRouter)`);
    } else {
      console.log('AI cost:      $0 (no AI call: cache hit, or the daily AI cap was reached)');
    }
    console.log(`TTS chars:    ${ttsCharacters}${ttsCharacters === 0 ? ' (no voice call)' : ''}`);
    console.log(`Time:         ${seconds} s`);

    if (result.audio) {
      const key = result.audio.url.split('/').pop() ?? '';
      const data = await blobs.get(key);
      if (data) {
        writeFileSync(OUTPUT_FILE, data);
        console.log(`Audio:        saved ${data.byteLength} bytes to ${OUTPUT_FILE}`);
      } else {
        console.log('Audio:        the server reported audio but the file is missing.');
      }
    } else {
      console.log(`Audio:        none (${tts.name === 'none' ? 'TTS_PROVIDER=none: the phone would speak it' : 'cap reached or the voice failed'})`);
    }
    if (config.cachePath === null) console.log('\nNote: set CACHE_PATH to keep the cache between runs (so a second run is free).');
  } finally {
    blobs.close?.();
    cache.close?.();
  }
}

main().catch((err: unknown) => {
  if (err instanceof EnvError) {
    console.error(err.message);
  } else if (err instanceof NarrationError) {
    console.error(`Narration failed: ${err.code} - ${err.message}`);
  } else if (err instanceof Error) {
    // Upstream error messages are written to be safe (no keys, urls or bodies).
    console.error(`Failed: ${err.name}: ${err.message}`);
  } else {
    console.error('Failed with an unknown error.');
  }
  process.exit(1);
});
