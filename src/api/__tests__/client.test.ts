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

    it('does not time out (and clears its timer) when the response arrives in time', async () => {
      const fetchFn = mockFetch(async () => jsonResponse({ ok: 1 }));
      const client = createApiClient({ baseUrl: BASE, appToken: TOKEN, timeoutMs: 5000, fetchFn });

      const result = await client.get('/fast');

      expect(result).toEqual({ ok: true, data: { ok: 1 } });
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
