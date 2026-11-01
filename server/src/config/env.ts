import { z } from 'zod';
import type { VoiceOption } from '@shared/narration/tts-provider';
import { parseVoices } from './parse-voices';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  APP_TOKEN: z.string().min(16),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  UPSTREAM_CONTACT: z.string().trim().min(1),
  CACHE_PATH: z.string().trim().min(1).optional(),
  OVERPASS_URL: z.url().default('https://overpass-api.de/api/interpreter'),
  OPENROUTER_API_KEY: z.string().trim().min(1),
  OPENROUTER_MODEL: z.string().trim().min(1).default('google/gemini-2.5-flash-lite'),
  TTS_PROVIDER: z.enum(['none', 'elevenlabs']).default('none'),
  ELEVENLABS_API_KEY: z.string().trim().min(1).optional(),
  ELEVENLABS_VOICES: z.string().optional(),
  DAILY_LLM_CALL_CAP: z.coerce.number().int().min(0).default(300),
  DAILY_TTS_CHAR_CAP: z.coerce.number().int().min(0).default(5000),
  AUDIO_DIR: z.string().trim().min(1).optional(),
  NARRATION_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
});

export interface ServerConfig {
  port: number;
  host: string;
  appToken: string;
  rateLimitPerMinute: number;
  /** Number of reverse-proxy hops in front of the server. */
  trustProxy: number;
  /** Contact info (email or repo URL) sent in the User-Agent of upstream calls. */
  contact: string;
  /** SQLite file for the persistent cache; null means in-memory. */
  cachePath: string | null;
  overpassUrl: string;
  openRouterApiKey: string;
  openRouterModel: string;
  ttsProvider: 'none' | 'elevenlabs';
  /** Set only when ttsProvider is "elevenlabs". */
  elevenLabs: { apiKey: string; voices: VoiceOption[] } | null;
  dailyLlmCallCap: number;
  dailyTtsCharCap: number;
  /** Directory for cached audio files; null means an in-memory audio cache. */
  audioDir: string | null;
  /** Stricter per-IP limit for POST /narrations (the only route that costs money). */
  narrationRateLimitPerMinute: number;
}

/** Thrown by parseEnv. The message names the bad variables, never their values. */
export class EnvError extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(`Invalid environment configuration. Check these variables: ${variables.join(', ')}`);
    this.name = 'EnvError';
    this.variables = variables;
  }
}

/** Pure: validates a raw env map (e.g. process.env) into a typed config. */
export function parseEnv(source: Record<string, string | undefined>): ServerConfig {
  // Treat empty strings (e.g. "PORT=") as unset so defaults apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const names = new Set(result.error.issues.map((issue) => String(issue.path[0] ?? 'unknown')));
    throw new EnvError([...names]);
  }
  const env = result.data;
  let elevenLabs: ServerConfig['elevenLabs'] = null;
  if (env.TTS_PROVIDER === 'elevenlabs') {
    const voices = env.ELEVENLABS_VOICES === undefined ? null : parseVoices(env.ELEVENLABS_VOICES);
    const bad = [
      ...(env.ELEVENLABS_API_KEY === undefined ? ['ELEVENLABS_API_KEY'] : []),
      ...(voices === null ? ['ELEVENLABS_VOICES'] : []),
    ];
    if (bad.length > 0 || env.ELEVENLABS_API_KEY === undefined || voices === null) throw new EnvError(bad);
    elevenLabs = { apiKey: env.ELEVENLABS_API_KEY, voices };
  }
  return {
    port: env.PORT,
    host: env.HOST,
    appToken: env.APP_TOKEN,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    trustProxy: env.TRUST_PROXY,
    contact: env.UPSTREAM_CONTACT,
    cachePath: env.CACHE_PATH ?? null,
    overpassUrl: env.OVERPASS_URL,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    openRouterModel: env.OPENROUTER_MODEL,
    ttsProvider: env.TTS_PROVIDER,
    elevenLabs,
    dailyLlmCallCap: env.DAILY_LLM_CALL_CAP,
    dailyTtsCharCap: env.DAILY_TTS_CHAR_CAP,
    audioDir: env.AUDIO_DIR ?? null,
    narrationRateLimitPerMinute: env.NARRATION_RATE_LIMIT_PER_MINUTE,
  };
}
