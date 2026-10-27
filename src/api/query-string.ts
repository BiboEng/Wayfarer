/** Appends `params` to `path` as a URL-encoded query string. */
export function withQuery(path: string, params: Record<string, string | number>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}?${query}` : path;
}
