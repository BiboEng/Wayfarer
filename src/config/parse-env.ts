export interface AppEnv {
  /** Server base URL without a trailing slash, or null when unset/invalid. */
  apiUrl: string | null;
  /** Shared app token. Public by design (it ships in the bundle). */
  appToken: string;
}

export interface RawAppEnv {
  apiUrl?: string;
  appToken?: string;
}

export function parseAppEnv(raw: RawAppEnv): AppEnv {
  return {
    apiUrl: parseApiUrl(raw.apiUrl),
    appToken: raw.appToken?.trim() ?? '',
  };
}

function parseApiUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\/[^/\s]+/i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, '');
}
