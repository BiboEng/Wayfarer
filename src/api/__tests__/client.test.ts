import { APP_TOKEN_HEADER } from '@shared/api/endpoints';

import { createApiClient } from '../client';

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(impl: (...args: FetchArgs) => Promise<Response>): jest.Mock<Promise<Response>, FetchArgs> {
  return jest.fn(impl);
}

const BASE = 'https://api.example.com';
const TOKEN = 'test-token';

describe('createApiClient', () => {
  it('returns the parsed body on success', async () => {
    const fetchFn = mockFetch(async () => jsonResponse({ status: 'ok', version: '1.2.3' }));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get<{ status: string; version: string }>('/health');

    expect(result).toEqual({ ok: true, data: { status: 'ok', version: '1.2.3' } });
  });

  it('builds the URL from baseUrl + path and sends the app token header', async () => {
    const fetchFn = mockFetch(async () => jsonResponse({}));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    await client.get('/health');

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.example.com/health');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ [APP_TOKEN_HEADER]: TOKEN, Accept: 'application/json' });
    expect(init?.signal).toBeDefined();
  });

  it('returns the server ApiError when the error body matches the contract', async () => {
    const body = { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid app token.' } };
    const fetchFn = mockFetch(async () => jsonResponse(body, 401));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get('/x');

    expect(result).toEqual({ ok: false, error: body.error });
  });

  it('returns BAD_RESPONSE when an error body is not an ApiError', async () => {
    const fetchFn = mockFetch(async () => jsonResponse({ message: 'nope' }, 500));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get('/x');

    expect(result).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
  });

  it('returns BAD_RESPONSE when an error body has an unknown code', async () => {
    const fetchFn = mockFetch(async () => jsonResponse({ error: { code: 'TEAPOT', message: 'x' } }, 418));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get('/x');

    expect(result).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
  });

  it('returns BAD_RESPONSE for a non-JSON body (success status)', async () => {
    const fetchFn = mockFetch(async () => new Response('<html>oops</html>', { status: 200 }));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get('/x');

    expect(result).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
  });

  it('returns BAD_RESPONSE for a non-JSON body (error status)', async () => {
    const fetchFn = mockFetch(async () => new Response('Bad Gateway', { status: 502 }));
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get('/x');

    expect(result).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
  });

  it('returns NETWORK_ERROR when fetch rejects', async () => {
    const fetchFn = mockFetch(async () => {
      throw new TypeError('Network request failed');
    });
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    const result = await client.get('/x');

    expect(result).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR' } });
  });

  it('never throws, even when fetch throws synchronously', async () => {
    const fetchFn = jest.fn((): Promise<Response> => {
      throw new Error('boom');
    });
    const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

    await expect(client.get('/x')).resolves.toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR' } });
  });

  it('returns NOT_CONFIGURED without calling fetch when baseUrl is null', async () => {
    const fetchFn = mockFetch(async () => jsonResponse({}));
    const client = createApiClient({ baseUrl: null, appToken: TOKEN, fetchFn });

    const result = await client.get('/health');

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_CONFIGURED' } });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  describe('timeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('returns TIMEOUT when the request outlives timeoutMs', async () => {
      // Never resolves; rejects only when the abort signal fires, like real fetch.
      const fetchFn = mockFetch(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn });

      const pending = client.get('/slow');
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await jest.advanceTimersByTimeAsync(4999);
      expect(settled).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
    });

    const hanging = () =>
      mockFetch(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

    it('lets a per-call timeoutMs override the client default (longer)', async () => {
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn: hanging() });
      const pending = client.get('/slow', { timeoutMs: 20_000 });
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await jest.advanceTimersByTimeAsync(19_999);
      expect(settled).toBe(false); // the 5 s default would have fired long ago
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
    });

    it('lets a per-call timeoutMs override the client default (shorter)', async () => {
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn: hanging() });
      const pending = client.get('/slow', { timeoutMs: 1000 });
      await jest.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
    });

    it('does not change the default for later calls without options', async () => {
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn: hanging() });
      const first = client.get('/slow', { timeoutMs: 20_000 });
      const second = client.get('/slow');
      await jest.advanceTimersByTimeAsync(5000);
      await expect(second).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
      await jest.advanceTimersByTimeAsync(15_000);
      await expect(first).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
    });

    it('falls back to the client default when options has no timeoutMs', async () => {
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn: hanging() });
      const pending = client.get('/slow', {});
      await jest.advanceTimersByTimeAsync(5000);
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
    });

    it('does not time out (and clears its timer) when the response arrives in time', async () => {
      const fetchFn = mockFetch(async () => jsonResponse({ ok: 1 }));
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn });

      const result = await client.get('/fast');

      expect(result).toEqual({ ok: true, data: { ok: 1 } });
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('post', () => {
    it('sends the body as JSON with a JSON content type, the token and the POST method', async () => {
      const fetchFn = mockFetch(async () => jsonResponse({ ok: 1 }));
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn });

      const result = await client.post<{ ok: number }>('/narrations', { landmarkId: 'wiki:1', length: 'short' });

      expect(result).toEqual({ ok: true, data: { ok: 1 } });
      const [url, init] = fetchFn.mock.calls[0];
      expect(url).toBe('https://api.example.com/narrations');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        [APP_TOKEN_HEADER]: TOKEN,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init?.body))).toEqual({ landmarkId: 'wiki:1', length: 'short' });
      expect(init?.signal).toBeDefined();
    });

    it('get sends no body and no content type', async () => {
      const fetchFn = mockFetch(async () => jsonResponse({}));
      await createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn }).get('/health');
      const init = fetchFn.mock.calls[0][1];
      expect(init?.body).toBeUndefined();
      expect(init?.headers).not.toHaveProperty('Content-Type');
    });

    it('returns the server error code for non-2xx answers (for example NOT_NARRATABLE)', async () => {
      const fetchFn = mockFetch(async () =>
        jsonResponse({ error: { code: 'NOT_NARRATABLE', message: 'No article text.' } }, 422),
      );
      const result = await createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn }).post('/narrations', {});
      expect(result).toEqual({ ok: false, error: { code: 'NOT_NARRATABLE', message: 'No article text.' } });
    });

    it('returns NOT_CONFIGURED without calling fetch when there is no base url', async () => {
      const fetchFn = mockFetch(async () => jsonResponse({}));
      const result = await createApiClient({ baseUrl: null, appToken: TOKEN, fetchFn }).post('/x', {});
      expect(result).toMatchObject({ ok: false, error: { code: 'NOT_CONFIGURED' } });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('returns NETWORK_ERROR when fetch fails, and BAD_RESPONSE for unreadable bodies', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined); // dev-only log in the client
      const failing = mockFetch(async () => {
        throw new TypeError('Network request failed');
      });
      expect(await createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn: failing }).post('/x', {})).toMatchObject({
        error: { code: 'NETWORK_ERROR' },
      });
      const html = mockFetch(async () => new Response('<html>', { status: 502 }));
      expect(await createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn: html }).post('/x', {})).toMatchObject({
        error: { code: 'BAD_RESPONSE' },
      });
      warn.mockRestore();
    });

    describe('timeout', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      const hanging = () =>
        mockFetch(
          (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        );

      it('uses the client default timeout unless a per-call timeoutMs is given', async () => {
        const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn: hanging() });
        const pending = client.post('/slow', {});
        await jest.advanceTimersByTimeAsync(5000);
        await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
      });

      it('lets a per-call timeoutMs override the default (45 s for narrations)', async () => {
        const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn: hanging() });
        const pending = client.post('/slow', {}, { timeoutMs: 45_000 });
        let settled = false;
        void pending.then(() => {
          settled = true;
        });
        await jest.advanceTimersByTimeAsync(44_999);
        expect(settled).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'TIMEOUT' } });
      });

      it('clears its timer after a quick answer', async () => {
        const fetchFn = mockFetch(async () => jsonResponse({ ok: 1 }));
        await createApiClient({ baseUrl: BASE, appToken: TOKEN, fetchFn }).post('/fast', {});
        expect(jest.getTimerCount()).toBe(0);
      });
    });
  });
});
