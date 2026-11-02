/**
 * Header the app sends on every request. The server compares it with its
 * APP_TOKEN. This is a speed bump against casual abuse, not real authentication:
 * the token ships inside the app bundle and can be extracted.
 */
export const APP_TOKEN_HEADER = 'x-wayfarer-token';

/** Server routes. */
export const ENDPOINTS = {
  /** Public (no app token) so the host's health check can reach it. */
  health: '/health',
  /** GET, see `NearbyLandmarksQuery` / `NearbyLandmarksResponse`. */
  landmarksNearby: '/landmarks/nearby',
  /** GET, see `NearestLandmarkQuery` / `NearestLandmarkResponse`. */
  landmarksNearest: '/landmarks/nearest',
  /** POST, see `NarrationRequest` / `NarrationResponse`. Rate-limited more strictly: it costs money. */
  narrations: '/narrations',
  /** GET `${narrationAudio}/:key`, audio bytes from the cache only (never triggers TTS). */
  narrationAudio: '/narrations/audio',
  /** GET, see `VoicesResponse`. */
  voices: '/voices',
  /** GET `${cues}/:cue?voice=`, see `CueResponse`. A fixed orientation line, made once per voice. */
  cues: '/narrations/cues',
} as const;
