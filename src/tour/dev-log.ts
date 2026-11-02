/**
 * Dev-only logging for the Live Tour. Never pass URLs, headers or tokens here; error details are
 * scrubbed of URLs anyway. Release builds log nothing. console.log (not warn): LogBox toasts
 * would cover the Live Tour buttons.
 */
import { redactUrls } from '@/audio/dev-log';

export function tourLog(message: string, detail?: string): void {
  if (!__DEV__) return;
  console.log(`[tour] ${message}${detail ? `: ${redactUrls(detail)}` : ''}`);
}
