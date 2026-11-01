import type { NarrationResponse } from '@shared/api/narration';
import type { Landmark } from '@shared/landmarks/landmark';

import type { ClientError } from '@/api/client';

export const LANDMARK: Landmark = {
  id: 'wiki:42764',
  name: 'Test Bridge',
  location: { lat: 51.5055, lng: -0.0754 },
  kind: 'bridge',
};

export const NARRATION: NarrationResponse = {
  landmarkId: 'wiki:42764',
  text: 'A story about the bridge.',
  audio: { url: '/narrations/audio/abc', contentType: 'audio/mpeg' },
  source: 'ai',
};

export const error = (code: ClientError['code']): ClientError => ({ code, message: `test ${code}` });
