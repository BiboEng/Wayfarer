import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserAgent, createUpstreamHttp } from '../http';
import { LandmarkUpstreamError } from '../landmark-upstream-error';

type FetchFn = typeof fetch;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** A fetch that never answers but rejects when its signal aborts. */
const hangingFetch: FetchFn = (_url, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });

function make(fetchFn: FetchFn, sleep = vi.fn(() => Promise.resolve())) {
  const http = createUpstreamHttp({ name: 'test', userAgent: 'UA/1', timeoutMs: 1000, retryDelayMs: 300, fetchFn, sleep });
  return { http, sleep };
}

describe('buildUserAgent', () => {
  it('formats Wayfarer/<version> (<contact>)', () => {
    expect(buildUserAgent('1.2.3', 'me@example.com')).toBe('Wayfarer/1.2.3 (me@example.com)');
  });

  it('strips control characters and trims', () => {
    expect(buildUserAgent('1', '  a\r\nb\u0000c ')).toBe('Wayfarer/1 (a  b c)');
  });
});

describe('createUpstreamHttp', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns parsed JSON and sends the User-Agent and Accept headers', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json({ ok: 1 }));
    const { http } = make(fetchFn);
    await expect(http.getJson({ url: 'https://x.test/a' })).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://x.test/a');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ 'User-Agent': 'UA/1', Accept: 'application/json' });
    expect(init?.signal).toBeDefined();
  });

  it('POSTs a form-encoded body', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json({}));
    const { http } = make(fetchFn);
    await http.getJson({ url: 'https://x.test/', method: 'POST', body: 'data=1' });
    const init = fetchFn.mock.calls[0][1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('data=1');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
  });

  it.each([500, 502, 503, 429])('retries once after HTTP %d and returns the second answer', async (status) => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, status)).mockResolvedValueOnce(json({ ok: 2 }));
    const { http, sleep } = make(fetchFn);
    await expect(http.getJson({ url: 'https://x.test/' })).resolves.toEqual({ ok: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(300, undefined);
  });

  it('honours Retry-After, capped at 5 seconds', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(json({}, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(json({}, 429, { 'Retry-After': '120' }));
    const { http, sleep } = make(fetchFn);
    await expect(http.getJson({ url: 'https://x.test/' })).rejects.toBeInstanceOf(LandmarkUpstreamError);
    expect(sleep).toHaveBeenCalledWith(2000, undefined);

    const again = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, 503, { 'Retry-After': '120' })).mockResolvedValueOnce(json({}));
    const second = make(again);
    await second.http.getJson({ url: 'https://x.test/' });
    expect(second.sleep).toHaveBeenCalledWith(5000, undefined);
  });

  it('gives up after a single retry with a LandmarkUpstreamError carrying the status', async () => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, 503)));
    const { http } = make(fetchFn);
    const error = await http.getJson({ url: 'https://x.test/' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LandmarkUpstreamError);
    expect((error as LandmarkUpstreamError).status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403, 404])('does not retry HTTP %d', async (status) => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, status)));
    const { http, sleep } = make(fetchFn);
    await expect(http.getJson({ url: 'https://x.test/' })).rejects.toMatchObject({ name: 'LandmarkUpstreamError', status });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('turns a network error into LandmarkUpstreamError without retrying', async () => {
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(new TypeError('fetch failed'));
    const { http } = make(fetchFn);
    await expect(http.getJson({ url: 'https://x.test/' })).rejects.toBeInstanceOf(LandmarkUpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('turns unparsable JSON into LandmarkUpstreamError', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response('<html>', { status: 200 }));
    const { http } = make(fetchFn);
    await expect(http.getJson({ url: 'https://x.test/' })).rejects.toBeInstanceOf(LandmarkUpstreamError);
  });

  it('times out a hanging request', async () => {
    const { http } = make(hangingFetch);
    const result = http.getJson({ url: 'https://x.test/' }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1001);
    const error = await result;
    expect(error).toBeInstanceOf(LandmarkUpstreamError);
    expect((error as Error).message).toContain('timed out');
  });

  it('does not retry after a timeout', async () => {
    const fetchFn = vi.fn<FetchFn>(hangingFetch);
    const { http } = make(fetchFn);
    const result = http.getJson({ url: 'https://x.test/' }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1001);
    await result;
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('applies a fresh timeout to the retry', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, 503)).mockImplementationOnce(hangingFetch);
    const { http } = make(fetchFn);
    const result = http.getJson({ url: 'https://x.test/' }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await result).toBeInstanceOf(LandmarkUpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rethrows the caller abort reason instead of an upstream error', async () => {
    const { http } = make(hangingFetch);
    const controller = new AbortController();
    const result = http.getJson({ url: 'https://x.test/' }, controller.signal).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    const reason = new Error('client left');
    controller.abort(reason);
    expect(await result).toBe(reason);
  });

  it('does not call fetch when the signal is already aborted', async () => {
    const fetchFn = vi.fn<FetchFn>();
    const { http } = make(fetchFn);
    const controller = new AbortController();
    controller.abort(new Error('gone'));
    await expect(http.getJson({ url: 'https://x.test/' }, controller.signal)).rejects.toThrow('gone');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  describe('retry:false', () => {
    it.each([500, 503, 429])('does not retry HTTP %d', async (code) => {
      const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, code)));
      const { http, sleep } = make(fetchFn);
      await expect(http.getJson({ url: 'https://x.test/', retry: false })).rejects.toMatchObject({
        name: 'LandmarkUpstreamError',
        status: code,
      });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('still returns a good first answer', async () => {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json({ ok: 1 }));
      const { http } = make(fetchFn);
      await expect(http.getJson({ url: 'https://x.test/', retry: false })).resolves.toEqual({ ok: 1 });
    });

    it('retry:true behaves like the default', async () => {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ ok: 2 }));
      const { http } = make(fetchFn);
      await expect(http.getJson({ url: 'https://x.test/', retry: true })).resolves.toEqual({ ok: 2 });
    });
  });

  describe('deadlineAt', () => {
    // retryDelayMs is 300 in make(); a retry needs wait (300) + 1500 ms of time left.
    const NOW = 1_000_000;
    beforeEach(() => vi.setSystemTime(NOW));

    it('skips the retry when wait + 1.5 s would pass the deadline', async () => {
      const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, 503)));
      const { http, sleep } = make(fetchFn);
      const error = await http.getJson({ url: 'https://x.test/', deadlineAt: NOW + 1799 }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LandmarkUpstreamError);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('retries when exactly enough time is left', async () => {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ ok: 3 }));
      const { http } = make(fetchFn);
      await expect(http.getJson({ url: 'https://x.test/', deadlineAt: NOW + 1800 })).resolves.toEqual({ ok: 3 });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('counts a long Retry-After against the deadline', async () => {
      const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, 503, { 'Retry-After': '4' })));
      const { http } = make(fetchFn);
      // 4000 + 1500 = 5500 needed; only 5000 left.
      await expect(http.getJson({ url: 'https://x.test/', deadlineAt: NOW + 5000 })).rejects.toBeInstanceOf(
        LandmarkUpstreamError,
      );
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does not affect requests that succeed, or that have no deadline', async () => {
      const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json({ ok: 1 }));
      const { http } = make(fetchFn);
      await expect(http.getJson({ url: 'https://x.test/', deadlineAt: NOW - 1 })).resolves.toEqual({ ok: 1 });
    });
  });

  it('error messages carry no URL or contact', async () => {
    const fetchFn = vi.fn<FetchFn>().mockImplementation(() => Promise.resolve(json({}, 503)));
    const http = createUpstreamHttp({ name: 'wikipedia', userAgent: 'Wayfarer/1 (secret@contact.test)', timeoutMs: 1000, fetchFn, sleep: () => Promise.resolve() });
    const error = (await http.getJson({ url: 'https://x.test/private' }).catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain('secret@contact.test');
    expect(error.message).not.toContain('x.test');
  });
});
