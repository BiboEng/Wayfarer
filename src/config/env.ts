import { parseAppEnv } from './parse-env';

// EXPO_PUBLIC_* values are inlined into the app bundle at build time, so they
// must be read with static `process.env.NAME` access and are never secret.
export const appEnv = parseAppEnv({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  appToken: process.env.EXPO_PUBLIC_APP_TOKEN,
});
