import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ENDPOINTS } from '@shared/api/endpoints';
import type { NarrationRequest } from '@shared/api/narration';
import { NARRATION_LENGTHS, TRAVEL_MODES } from '@shared/narration/options';
import { AUDIO_CONTENT_TYPE, isValidBlobKey, type BlobStore } from '../cache/blob-store';
import { guarded } from '../http/guarded';
import { sendApiError } from '../http/api-error';
import { NarrationError } from '../narration/narration-error';
import type { Narrator } from '../narration/narrate';

const bodySchema = z
  .object({
    // Landmark ids look like "wiki:12345" or "osm:way/678".
    landmarkId: z.string().regex(/^[A-Za-z0-9:_/.-]{1,64}$/),
    length: z.enum(NARRATION_LENGTHS),
    travelMode: z.enum(TRAVEL_MODES),
    voice: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  })
  .strict();

export interface NarrationRouterDeps {
  narrator: Narrator;
  blobs: BlobStore;
  /** Stricter per-IP limiter for the one route that costs money. */
  narrationLimiter: RequestHandler;
}

export function createNarrationRouter(deps: NarrationRouterDeps): Router {
  const router = Router();

  router.post(
    ENDPOINTS.narrations,
    deps.narrationLimiter,
    guarded(async (req, res, signal) => {
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'BAD_REQUEST', 'Invalid landmarkId, length, travelMode or voice.');
        return;
      }
      const request: NarrationRequest = parsed.data;
      try {
        const body = await deps.narrator.narrate(request, signal);
        if (signal.aborted) return;
        res.json(body);
      } catch (err) {
        if (err instanceof NarrationError) {
          sendApiError(res, err.status, err.code, err.message);
          return;
        }
        throw err;
      }
    }),
  );

  // Serves files that already exist. It can never trigger a TTS call.
  router.get(
    `${ENDPOINTS.narrationAudio}/:key`,
    guarded(async (req, res) => {
      const key = String(req.params.key);
      const data = isValidBlobKey(key) ? await deps.blobs.get(key) : undefined;
      if (!data) {
        sendApiError(res, 404, 'NOT_FOUND', 'Audio not found.');
        return;
      }
      res
        .status(200)
        .type(AUDIO_CONTENT_TYPE)
        .set('Cache-Control', 'private, max-age=86400')
        .set('Content-Length', String(data.byteLength))
        .end(data);
    }),
  );

  return router;
}
