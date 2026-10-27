import { LandmarkUpstreamError } from './landmark-upstream-error';
import { createLimiter, defaultSleep, type Limiter, type SleepFn } from './throttle';

export interface UpstreamRequest {
  url: string;
  method?: 'GET' | 'POST';
  /** Form-encoded body for POST. */
  body?: string;
  /** Set false to never retry (request-path calls with a tight budget). Default true. */
  retry?: boolean;
  /** Epoch ms after which a retry is pointless; the retry is skipped when it would not fit. */
  deadlineAt?: number;
}

export interface UpstreamHttp {
  /** Fetches JSON. Throws LandmarkUpstreamError, or the signal's reason if the caller aborted. */
  getJson(request: UpstreamRequest, signal?: AbortSignal): Promise<unknown>;
}

export interface UpstreamHttpOptions {
  /** Short name used in error messages, e.g. "wikipedia". */
  name: string;
  userAgent: string;
  timeoutMs: number;
  /** Delay before the single retry when the server gives no Retry-After. */
  retryDelayMs?: number;
  limiter?: Limiter;
  fetchFn?: typeof fetch;
  sleep?: SleepFn;
}

export const WIKIPEDIA_TIMEOUT_MS = 8_000;
export const OVERPASS_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_AFTER_MS = 5_000;
/** A retry only starts if at least this much time remains after its wait. */
const MIN_RETRY_ATTEMPT_MS = 1_500;

/** Builds "Wayfarer/<version> (<contact>)". The contact comes from config; control characters are stripped. */
export function buildUserAgent(version: string, contact: string): string {
  // eslint-disable-next-line no-control-regex -- header values must not contain control characters
  const safe = contact.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return `Wayfarer/${version} (${safe})`;
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelay(response: Response, fallbackMs: number): number {
  const seconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  return fallbackMs;
}

type Attempt = { json: unknown } | { retryAfterMs: number };

export function createUpstreamHttp(options: UpstreamHttpOptions): UpstreamHttp {
  const fetchFn = options.fetchFn ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const limiter = options.limiter ?? createLimiter({ concurrency: 1, minIntervalMs: 0 });
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const fail = (message: string, status?: number) => new LandmarkUpstreamError(options.name, message, status);

  async function attempt(request: UpstreamRequest, canRetry: boolean, signal?: AbortSignal): Promise<Attempt> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener('abort', onCallerAbort, { once: true });
    try {
      const headers: Record<string, string> = { 'User-Agent': options.userAgent, Accept: 'application/json' };
      if (request.body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const response = await fetchFn(request.url, {
        method: request.method ?? 'GET',
        headers,
        body: request.body,
        signal: controller.signal,
      });
      if (!response.ok) {
        if (canRetry && isRetryable(response.status)) {
          await response.body?.cancel().catch(() => undefined);
          return { retryAfterMs: retryDelay(response, retryDelayMs) };
        }
        throw fail(`HTTP ${response.status}`, response.status);
      }
      return { json: await response.json() };
    } catch (error) {
      if (error instanceof LandmarkUpstreamError) throw error;
      if (signal?.aborted) throw signal.reason;
      if (timedOut) throw fail('timed out');
      throw fail('request failed');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  return {
    getJson(request, signal) {
      return limiter.run(async () => {
        const first = await attempt(request, request.retry !== false, signal);
        if ('json' in first) return first.json;
        if (request.deadlineAt !== undefined && Date.now() + first.retryAfterMs + MIN_RETRY_ATTEMPT_MS > request.deadlineAt) {
          throw fail('no time left to retry');
        }
        await sleep(first.retryAfterMs, signal);
        const second = await attempt(request, false, signal);
        if ('json' in second) return second.json;
        throw fail('retry failed');
      }, signal);
    },
  };
}
