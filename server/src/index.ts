import { createApp } from './app';
import { createBlobStore } from './cache/create-blob-store';
import { createCacheStore } from './cache/create-cache-store';
import { EnvError, parseEnv, type ServerConfig } from './config/env';
import { loadEnvFile } from './config/load-env-file';
import { createCapStore } from './costs/create-cap-store';
import { createDailyCaps } from './costs/daily-caps';
import { createLandmarkService } from './landmarks';
import { createCueService } from './narration/cues';
import { createNarrator } from './narration/narrate';
import { createOpenRouterClient } from './narration/openrouter-client';
import { createTtsProvider } from './tts/create-tts-provider';

function main(): void {
  loadEnvFile();

  let config: ServerConfig;
  try {
    config = parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const cache = createCacheStore(config.cachePath);
  const blobs = createBlobStore(config.audioDir);
  const tts = createTtsProvider(config);
  const landmarks = createLandmarkService({ contact: config.contact, overpassUrl: config.overpassUrl, cache });
  const caps = createDailyCaps({
    cache: createCapStore(config.cachePath, cache),
    llmCalls: config.dailyLlmCallCap,
    ttsChars: config.dailyTtsCharCap,
  });
  const narrator = createNarrator({
    cache,
    blobs,
    landmarks,
    tts,
    llm: createOpenRouterClient({ apiKey: config.openRouterApiKey, model: config.openRouterModel }),
    caps,
  });
  const cues = createCueService({ blobs, tts, caps }); // shares the narrator's caps: both spend the same TTS budget
  if (config.cachePath === null) {
    console.warn('No CACHE_PATH: the cache and the daily cost caps are in memory and reset on every restart.');
  }

  const app = createApp(config, { landmarks, narrator, cues, blobs, tts });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Wayfarer server listening on ${config.host}:${config.port} (tts: ${tts.name})`);
  });

  // Stop accepting connections, let in-flight requests finish, then release the stores.
  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    console.log(`Received ${signal}, shutting down.`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => {
      blobs.close?.();
      cache.close?.();
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
