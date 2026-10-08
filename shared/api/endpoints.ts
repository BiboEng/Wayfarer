/**
 * Header the app sends on every request. The server compares it with its
 * APP_TOKEN. This is a speed bump against casual abuse, not real authentication:
 * the token ships inside the app bundle and can be extracted.
 */
export const APP_TOKEN_HEADER = 'x-wayfarer-token';

/** Server routes. Phase 2 and 3 add landmark and narration routes here. */
export const ENDPOINTS = {
  /** Public (no app token) so the host's health check can reach it. */
  health: '/health',
} as const;
