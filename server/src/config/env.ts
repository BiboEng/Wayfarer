import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  APP_TOKEN: z.string().min(16),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  UPSTREAM_CONTACT: z.string().trim().min(1),
  CACHE_PATH: z.string().trim().min(1).optional(),
  OVERPASS_URL: z.url().default('https://overpass-api.de/api/interpreter'),
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
  return {
    port: env.PORT,
    host: env.HOST,
    appToken: env.APP_TOKEN,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    trustProxy: env.TRUST_PROXY,
    contact: env.UPSTREAM_CONTACT,
    cachePath: env.CACHE_PATH ?? null,
    overpassUrl: env.OVERPASS_URL,
  };
}
