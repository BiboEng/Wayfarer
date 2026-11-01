import { Router } from 'express';
import { ENDPOINTS } from '@shared/api/endpoints';
import type { VoicesResponse } from '@shared/api/narration';
import type { TTSProvider } from '@shared/narration/tts-provider';

export function createVoicesRouter(tts: Pick<TTSProvider, 'voices'>): Router {
  const router = Router();
  router.get(ENDPOINTS.voices, (_req, res) => {
    const body: VoicesResponse = {
      voices: [...tts.voices],
      defaultVoice: tts.voices[0]?.id ?? null,
    };
    res.json(body);
  });
  return router;
}
