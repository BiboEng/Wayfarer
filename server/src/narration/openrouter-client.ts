import { withTimeout } from '../http/timeout-signal';
import { UpstreamError } from '../http/upstream-error';
import type { ChatMessage } from './prompt';

export interface LlmResult {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  /** Cost in USD as reported by OpenRouter for this call (usage.cost), if present. */
  costUsd?: number;
  finishReason?: string;
}

export interface LlmClient {
  complete(messages: ChatMessage[], maxTokens: number, signal?: AbortSignal): Promise<LlmResult>;
}

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  /** Timeout of one attempt. */
  timeoutMs?: number;
  /** Total time for all attempts; the retry is skipped if less than minRetryBudgetMs is left. */
  totalBudgetMs?: number;
  minRetryBudgetMs?: number;
  /** Wait before the single retry. */
  retryDelayMs?: number;
  now?: () => number;
}

const UPSTREAM = 'openrouter';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Pure: reads text and usage from a chat completions reply. Throws UpstreamError if there is no text. */
export function parseCompletion(body: unknown, fallbackModel: string): LlmResult {
  const choices = isRecord(body) && Array.isArray(body.choices) ? (body.choices as unknown[]) : [];
  const choice = choices[0];
  const message = isRecord(choice) ? choice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new UpstreamError(UPSTREAM, 'reply had no text');
  }
  const usage = isRecord(body) && isRecord(body.usage) ? body.usage : {};
  return {
    text: content,
    model: isRecord(body) && typeof body.model === 'string' ? body.model : fallbackModel,
    promptTokens: num(usage.prompt_tokens),
    completionTokens: num(usage.completion_tokens),
    costUsd: num(usage.cost),
    finishReason: isRecord(choice) && typeof choice.finish_reason === 'string' ? choice.finish_reason : undefined,
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const retryable = (status: number): boolean => status === 429 || status >= 500;

/** OpenRouter chat completions over built-in fetch: 10 s per attempt, 15 s in total, one retry on 429/5xx only if time remains. Never logs keys or bodies. */
export function createOpenRouterClient(options: OpenRouterOptions): LlmClient {
  const fetchFn = options.fetchFn ?? fetch;
  const url = `${options.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const totalBudgetMs = options.totalBudgetMs ?? 15_000;
  const minRetryBudgetMs = options.minRetryBudgetMs ?? 6_000;
  const now = options.now ?? Date.now;
  const retryDelayMs = options.retryDelayMs ?? 500;

  async function attempt(messages: ChatMessage[], maxTokens: number, attemptTimeoutMs: number, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
        signal: withTimeout(attemptTimeoutMs, signal),
      });
    } catch (err) {
      if (signal?.aborted) throw err; // the caller cancelled; let it through unchanged
      // Replace the original error: it may quote request details.
      throw new UpstreamError(UPSTREAM, err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'network error');
    }
  }

  return {
    async complete(messages, maxTokens, signal) {
      const started = now();
      let res = await attempt(messages, maxTokens, Math.min(timeoutMs, totalBudgetMs), signal);
      if (retryable(res.status)) {
        await res.body?.cancel().catch(() => undefined);
        const remaining = totalBudgetMs - (now() - started) - retryDelayMs;
        if (remaining >= minRetryBudgetMs) {
          await sleep(retryDelayMs);
          res = await attempt(messages, maxTokens, Math.min(timeoutMs, remaining), signal);
        }
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new UpstreamError(UPSTREAM, `HTTP ${res.status}`, res.status);
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new UpstreamError(UPSTREAM, 'reply was not valid JSON');
      }
      return parseCompletion(body, options.model);
    },
  };
}
