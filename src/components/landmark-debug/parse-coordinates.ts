import type { LatLng } from '@shared/geo/lat-lng';

const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)';
// Two numbers split by a comma, a semicolon or whitespace (a separator is
// required, otherwise "1234" could be read as "123" and "4").
const PAIR = new RegExp(`^(${NUMBER})(?:\\s*[,;]\\s*|\\s+)(${NUMBER})$`);

/**
 * Parses "41.0086, 28.9802" (as pasted from Google Maps). Tolerates extra
 * spaces, a missing space after the comma, and a semicolon. Returns null when
 * the text is not two numbers or the values are out of range.
 */
export function parseCoordinates(text: string): LatLng | null {
  const match = PAIR.exec(text.trim());
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
