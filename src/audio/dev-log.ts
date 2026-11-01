/**
 * Dev-only logging for the audio module. Never pass headers here (they carry the app token);
 * URLs inside messages are replaced, since native error messages can include the request URL.
 */
export function devLog(message: string, detail?: string): void {
  if (!__DEV__) return;
  console.warn(`[audio] ${message}${detail ? `: ${redactUrls(detail)}` : ''}`);
}

export function redactUrls(text: string): string {
  return text.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>');
}
