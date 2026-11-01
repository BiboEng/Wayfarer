import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../../http/upstream-error';
import { createOpenRouterClient, parseCompletion } from '../openrouter-client';
import type { ChatMessage } from '../prompt';

type FetchFn = typeof fetch;

const KEY = 'test-openrouter-key-not-real';
const MESSAGES: ChatMessage[] = [
  { role: 'system', content: 'rules' },
  { role: 'user', content: 'tell the story' },
];

const reply = (overrides: Record<string, unknown> = {}) => ({
  id: 'gen-1',
  model: 'google/gemini-2.5-flash-lite',
  choices: [{ message: { role: 'assistant', content: 'A story.' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500, cost: 0.00024 },
  ...overrides,
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const hanging: FetchFn = (_url, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
  });

function client(fetchFn: FetchFn, extra: Partial<Parameters<typeof createOpenRouterClient>[0]> = {}) {
  return createOpenRouterClient({ apiKey: KEY, model: 'test/model', fetchFn, retryDelayMs: 0, ...extra });
}

describe('parseCompletion', () => {
  it('reads text, model, token usage, cost and finish reason', () => {
    expect(parseCompletion(reply(), 'fallback')).toEqual({
      text: 'A story.',
      model: 'google/gemini-2.5-flash-lite',
      promptTokens: 1200,
      completionTokens: 300,
      costUsd: 0.00024,
      finishReason: 'stop',
    });
  });

  it('parses the cost from usage.cost, including 0', () => {
    expect(parseCompletion(reply({ usage: { cost: 0 } }), 'f').costUsd).toBe(0);
    expect(parseCompletion(reply({ usage: { cost: 0.5 } }), 'f').costUsd).toBe(0.5);
  });

  it('leaves usage fields undefined when absent or not numbers', () => {
    const result = parseCompletion(reply({ usage: { prompt_tokens: '1200', cost: null } }), 'f');
    expect(result.promptTokens).toBeUndefined();
    expect(result.costUsd).toBeUndefined();
    expect(parseCompletion(reply({ usage: undefined }), 'f').completionTokens).toBeUndefined();
  });

  it('falls back to the configured model name', () => {
    expect(parseCompletion(reply({ model: undefined }), 'my/model').model).toBe('my/model');
  });

  it.each([
    ['null', null],
    ['no choices', {}],
    ['empty choices', { choices: [] }],
    ['no message', { choices: [{}] }],
    ['null content', { choices: [{ message: { content: null } }] }],
    ['blank content', { choices: [{ message: { content: '  \n' } }] }],
    ['non-string content', { choices: [{ message: { content: ['x'] } }] }],
  ])('throws UpstreamError when the reply has no text (%s)', (_name, body) => {
    expect(() => parseCompletion(body, 'f')).toThrow(UpstreamError);
  });
});

describe('createOpenRouterClient: request', () => {
  it('POSTs to the chat completions endpoint with bearer auth and a JSON body', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(reply()));
    await client(fetchFn).complete(MESSAGES, 400);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'test/model', messages: MESSAGES, max_tokens: 400 });
  });

  it('does not put the key in the url or body', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(reply()));
    await client(fetchFn).complete(MESSAGES, 400);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).not.toContain(KEY);
    expect(String(init?.body)).not.toContain(KEY);
  });

  it('uses a custom base url and passes a signal so every call is bounded', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(reply()));
    await client(fetchFn, { baseUrl: 'https://proxy.example/v1' }).complete(MESSAGES, 100);
    expect(fetchFn.mock.calls[0][0]).toBe('https://proxy.example/v1/chat/completions');
    expect(fetchFn.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns the parsed result', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(reply()));
    expect(await client(fetchFn).complete(MESSAGES, 100)).toMatchObject({ text: 'A story.', costUsd: 0.00024 });
  });
});

describe('createOpenRouterClient: retry', () => {
  it.each([429, 500, 502, 503])('retries once after HTTP %d and returns the second answer', async (status) => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, status)).mockResolvedValueOnce(json(reply()));
    expect((await client(fetchFn).complete(MESSAGES, 100)).text).toBe('A story.');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry', async () => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, 503)));
    const error = await client(fetchFn).complete(MESSAGES, 100).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 402, 403, 404])('does not retry HTTP %d', async (status) => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, status)));
    await expect(client(fetchFn).complete(MESSAGES, 100)).rejects.toMatchObject({ name: 'UpstreamError', status });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a network error', async () => {
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(client(fetchFn).complete(MESSAGES, 100)).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('waits retryDelayMs before the retry', async () => {
    vi.useFakeTimers();
    try {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(reply()));
      const pending = createOpenRouterClient({ apiKey: KEY, model: 'm', fetchFn, retryDelayMs: 700 }).complete(MESSAGES, 100);
      await vi.advanceTimersByTimeAsync(699);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createOpenRouterClient: errors and secrets', () => {
  it('throws UpstreamError for an unreadable body', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(client(fetchFn).complete(MESSAGES, 100)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws UpstreamError for a reply without text', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json({ choices: [] }));
    await expect(client(fetchFn).complete(MESSAGES, 100)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('error messages never contain the key, url, request text or response body', async () => {
    const leaky = new TypeError(`fetch failed for https://openrouter.ai/api/v1 with Bearer ${KEY} and "tell the story"`);
    for (const fetchFn of [
      vi.fn<FetchFn>().mockRejectedValue(leaky),
      vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({ error: `bad key ${KEY}` }, 401))),
      vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({ error: `bad key ${KEY}` }, 503))),
    ]) {
      const error = (await client(fetchFn).complete(MESSAGES, 100).catch((e: unknown) => e)) as Error;
      const everything = `${error.message} ${error.name} ${String(error.stack)} ${JSON.stringify(error)}`;
      expect(everything).not.toContain(KEY);
      expect(everything).not.toContain('openrouter.ai');
      expect(everything).not.toContain('tell the story');
      expect(everything).not.toContain('bad key');
    }
  });
});

describe('createOpenRouterClient: timeout and abort', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uses a 10 second timeout per attempt by default and reports "timed out"', async () => {
    // AbortSignal.timeout is not driven by fake timers, so the call is observed through the signal it receives.
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const timeoutError = new DOMException('timed out', 'TimeoutError');
      const fetchFn = vi.fn<FetchFn>().mockRejectedValue(timeoutError);
      const error = (await client(fetchFn).complete(MESSAGES, 100).catch((e: unknown) => e)) as UpstreamError;
      expect(spy).toHaveBeenCalledWith(10_000);
      expect(error).toBeInstanceOf(UpstreamError);
      expect(error.message).toContain('timed out');
    } finally {
      spy.mockRestore();
    }
  });

  it('honours a custom timeout option', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(reply()));
      await client(fetchFn, { timeoutMs: 1234 }).complete(MESSAGES, 100);
      expect(spy).toHaveBeenCalledWith(1234);
    } finally {
      spy.mockRestore();
    }
  });

  it('really aborts a hanging request after the timeout (real clock, short timeout)', async () => {
    vi.useRealTimers();
    const error = (await client(hanging, { timeoutMs: 30 }).complete(MESSAGES, 100).catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.message).toContain('timed out');
  });

  it('rethrows the original error unchanged when the caller cancelled', async () => {
    vi.useRealTimers();
    const controller = new AbortController();
    const reason = new Error('client left');
    const pending = client(hanging).complete(MESSAGES, 100, controller.signal).catch((e: unknown) => e);
    controller.abort(reason);
    expect(await pending).toBe(reason);
  });
});

describe('createOpenRouterClient: total budget (10 s per attempt, 15 s overall, retry only if 6 s remain)', () => {
  /** A fake clock that the fake fetch advances, so "an attempt took N ms" is exact. */
  function timed(durations: number[], statuses: number[]) {
    let time = 1_000;
    let call = 0;
    const fetchFn = vi.fn<FetchFn>(() => {
      const i = call;
      call += 1;
      time += durations[i] ?? 0;
      return Promise.resolve(statuses[i] === 200 ? json(reply()) : json({}, statuses[i] ?? 503));
    });
    return { fetchFn, now: () => time };
  }

  function budgeted(fetchFn: FetchFn, now: () => number) {
    return createOpenRouterClient({ apiKey: KEY, model: 'm', fetchFn, now, retryDelayMs: 0 });
  }

  it('retries when plenty of time remains', async () => {
    const { fetchFn, now } = timed([2_000, 1_000], [503, 200]);
    expect((await budgeted(fetchFn, now).complete(MESSAGES, 100)).text).toBe('A story.');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries when exactly 6 s remain', async () => {
    const { fetchFn, now } = timed([9_000, 0], [503, 200]);
    await budgeted(fetchFn, now).complete(MESSAGES, 100);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry when less than 6 s remain, and reports the first failure', async () => {
    const { fetchFn, now } = timed([9_001], [503, 200]);
    const error = await budgeted(fetchFn, now).complete(MESSAGES, 100).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('counts the retry delay against the remaining time', async () => {
    let time = 0;
    const fetchFn = vi.fn<FetchFn>(() => {
      time += 8_800;
      return Promise.resolve(json({}, 503));
    });
    // 15 000 - 8 800 - 500 delay = 5 700 < 6 000: no retry.
    const client = createOpenRouterClient({ apiKey: KEY, model: 'm', fetchFn, now: () => time, retryDelayMs: 500 });
    await expect(client.complete(MESSAGES, 100)).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gives the retry only the time that is left, never more than 10 s', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const { fetchFn, now } = timed([6_000, 0], [503, 200]);
      await budgeted(fetchFn, now).complete(MESSAGES, 100);
      expect(spy.mock.calls.map((c) => c[0])).toEqual([10_000, 9_000]);

      spy.mockClear();
      const quick = timed([1_000, 0], [503, 200]);
      await budgeted(quick.fetchFn, quick.now).complete(MESSAGES, 100);
      expect(spy.mock.calls.map((c) => c[0])).toEqual([10_000, 10_000]);
    } finally {
      spy.mockRestore();
    }
  });

  it('never makes more than two attempts', async () => {
    const { fetchFn, now } = timed([100, 100, 100], [503, 503, 503]);
    await budgeted(fetchFn, now).complete(MESSAGES, 100).catch(() => undefined);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('options override the defaults', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    try {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(reply()));
      await createOpenRouterClient({ apiKey: KEY, model: 'm', fetchFn, timeoutMs: 3_000, totalBudgetMs: 2_000 }).complete(
        MESSAGES,
        100,
      );
      expect(spy).toHaveBeenCalledWith(2_000); // the first attempt can never outlast the total budget
    } finally {
      spy.mockRestore();
    }
  });
});
