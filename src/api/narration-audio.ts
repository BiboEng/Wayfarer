import { APP_TOKEN_HEADER } from '@shared/api/endpoints';
import type { NarrationAudio } from '@shared/api/narration';

import { appEnv } from '@/config/env';

/** A server audio file the player can stream; the request carries the app token. */
export interface RemoteAudioSource {
  uri: string;
  headers: Record<string, string>;
}

export interface AudioSourceConfig {
  baseUrl: string | null;
  appToken: string;
}

/** Turns the relative audio path in a narration into a playable source, or null without a server URL. */
export function buildAudioSource(config: AudioSourceConfig, audio: NarrationAudio): RemoteAudioSource | null {
  if (!config.baseUrl) return null;
  return {
    uri: `${config.baseUrl}${audio.url}`,
    headers: { [APP_TOKEN_HEADER]: config.appToken },
  };
}

/** `buildAudioSource` with the app's EXPO_PUBLIC_* config. */
export function narrationAudioSource(audio: NarrationAudio): RemoteAudioSource | null {
  return buildAudioSource({ baseUrl: appEnv.apiUrl, appToken: appEnv.appToken }, audio);
}
