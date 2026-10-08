import { appEnv } from '@/config/env';

import { createApiClient } from './client';

/** The app-wide client, configured from EXPO_PUBLIC_* env values. */
export const apiClient = createApiClient({
  baseUrl: appEnv.apiUrl,
  appToken: appEnv.appToken,
});
