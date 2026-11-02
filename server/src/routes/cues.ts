import { Router } from 'express';
import { z } from 'zod';
import { ENDPOINTS } from '@shared/api/endpoints';
import { isOrientationCue } from '@shared/narration/cues';
import { sendApiError } from '../http/api-error';
import { guarded } from '../http/guarded';
import type { CueService } from '../narration/cues';

const querySchema = z.object({ voice: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional() });

/** GET /narrations/cues/:cue?voice=. Cheap after the first call per cue + voice, so only the general rate limit applies. */
export function createCuesRouter(cues: CueService): Router {
  const router = Router();

  router.get(
    `${ENDPOINTS.cues}/:cue`,
    guarded(async (req, res, signal) => {
      const cue = req.params.cue;
      const query = querySchema.safeParse(req.query);
      if (!isOrientationCue(cue) || !query.success) {
        sendApiError(res, 400, 'BAD_REQUEST', 'Invalid cue or voice.');
        return;
      }
      const body = await cues.getCue(cue, query.data.voice);
      if (signal.aborted) return;
      res.json(body);
    }),
  );

  return router;
}
