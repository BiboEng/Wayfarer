import { Router } from 'express';
import { z } from 'zod';
import { ENDPOINTS } from '@shared/api/endpoints';
import type { NearbyLandmarksResponse, NearestLandmarkResponse } from '@shared/api/landmarks';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import type { NearbyQuery } from '@shared/landmarks/provider';
import { NEARBY_RADIUS_MAX_M, NEARBY_RADIUS_MIN_M } from '@shared/landmarks/search';
import { sendApiError } from '../http/api-error';
import { guarded } from '../http/guarded';

export interface LandmarkLookup {
  findNearby(query: NearbyQuery, signal?: AbortSignal): Promise<Landmark[]>;
  findNearest(center: LatLng, signal?: AbortSignal): Promise<NearestLandmarkResponse>;
}

// Query values arrive as strings; reject empty/missing so Number('') is never 0.
const num = z
  .string()
  .trim()
  .min(1)
  .transform(Number)
  .pipe(z.number().finite());
const nearestSchema = z.object({
  lat: num.pipe(z.number().min(-90).max(90)),
  lng: num.pipe(z.number().min(-180).max(180)),
});
const nearbySchema = nearestSchema.extend({
  radius: num.pipe(z.number().min(NEARBY_RADIUS_MIN_M).max(NEARBY_RADIUS_MAX_M)),
});

export function createLandmarksRouter(lookup: LandmarkLookup): Router {
  const router = Router();

  router.get(
    ENDPOINTS.landmarksNearby,
    guarded(async (req, res, signal) => {
      const parsed = nearbySchema.safeParse(req.query);
      if (!parsed.success) {
        sendApiError(res, 400, 'BAD_REQUEST', 'Invalid lat, lng or radius.');
        return;
      }
      const { lat, lng, radius } = parsed.data;
      const landmarks = await lookup.findNearby({ center: { lat, lng }, radiusMeters: radius }, signal);
      if (signal.aborted) return;
      const body: NearbyLandmarksResponse = { landmarks };
      res.json(body);
    }),
  );

  router.get(
    ENDPOINTS.landmarksNearest,
    guarded(async (req, res, signal) => {
      const parsed = nearestSchema.safeParse(req.query);
      if (!parsed.success) {
        sendApiError(res, 400, 'BAD_REQUEST', 'Invalid lat or lng.');
        return;
      }
      const body: NearestLandmarkResponse = await lookup.findNearest(parsed.data, signal);
      if (signal.aborted) return;
      res.json(body);
    }),
  );

  return router;
}
