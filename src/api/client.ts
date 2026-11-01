import { APP_TOKEN_HEADER } from '@shared/api/endpoints';
import { isApiError, type ErrorCode } from '@shared/api/errors';

/** Server error codes plus failures that only happen on the device. */
export type ClientErrorCode = ErrorCode | 'NOT_CONFIGURED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'BAD_RESPONSE';

export interface ClientError {
  code: ClientErrorCode;
  message: string;
}

/** Calls never throw: callers decide whether to skip quietly or show a state. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ClientError };

export interface ApiClientOptions {
  baseUrl: string | null;
  appToken: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface RequestOptions {
  /** Overrides the client's default timeout for this call. */
  timeoutMs?: number;
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>>;
  /** Sends `body` as JSON. */
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<ApiResult<T>>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, appToken, timeoutMs: defaultTimeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = fetch } = options;

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    { timeoutMs = defaultTimeoutMs }: RequestOptions,
  ): Promise<ApiResult<T>> {
    if (!baseUrl) {
      return fail('NOT_CONFIGURED', 'Server URL is not configured.');
    }

    const headers: Record<string, string> = { Accept: 'application/json', [APP_TOKEN_HEADER]: appToken };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      return await readResponse<T>(response);
    } catch (err) {
      // Dev-only: the underlying reason (cleartext blocked, DNS, refused...) is otherwise lost.
      if (__DEV__) console.warn(`[api] ${method} ${path} failed:`, err);
      return controller.signal.aborted
        ? fail('TIMEOUT', 'The server took too long to respond.')
        : fail('NETWORK_ERROR', 'Could not reach the server.');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: (path, requestOptions = {}) => request('GET', path, undefined, requestOptions),
    post: (path, body, requestOptions = {}) => request('POST', path, body, requestOptions),
  };
}

async function readResponse<T>(response: Response): Promise<ApiResult<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail('BAD_RESPONSE', `Unreadable response (HTTP ${response.status}).`);
  }

  if (response.ok) {
    // Trusts the shared contract; responses are not validated at runtime.
    return { ok: true, data: body as T };
  }
  if (isApiError(body)) {
    return { ok: false, error: body.error };
  }
  return fail('BAD_RESPONSE', `Unexpected error response (HTTP ${response.status}).`);
}

function fail(code: ClientErrorCode, message: string): { ok: false; error: ClientError } {
  return { ok: false, error: { code, message } };
}
