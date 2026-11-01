import express from 'express';
import type { TTSProvider } from '@shared/narration/tts-provider';
import type { BlobStore } from './cache/blob-store';
import type { ServerConfig } from './config/env';
import { appTokenMiddleware } from './middleware/app-token';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { healthRouter } from './routes/health';
import type { Narrator } from './narration/narrate';
import { createLandmarksRouter, type LandmarkLookup } from './routes/landmarks';
import { createNarrationRouter } from './routes/narration';
import { createVoicesRouter } from './routes/voices';

export interface AppDeps {
  landmarks: LandmarkLookup;
  narrator: Narrator;
  blobs: BlobStore;
  tts: Pick<TTSProvider, 'voices'>;
}

/** Builds the Express app without listening, so tests can drive it directly. */
export function createApp(config: ServerConfig, deps: AppDeps): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(rateLimitMiddleware(config.rateLimitPerMinute));

  // Public: the host's health check has no app token.
  app.use(healthRouter);

  app.use(appTokenMiddleware(config.appToken));

  // After the token check, so unauthenticated requests never get their bodies parsed.
  app.use(express.json({ limit: '10kb' }));

  app.use(createLandmarksRouter(deps.landmarks));

  app.use(createVoicesRouter(deps.tts));
  app.use(
    createNarrationRouter({
      narrator: deps.narrator,
      blobs: deps.blobs,
      // On top of the global limiter: this is the only route that costs money.
      narrationLimiter: rateLimitMiddleware(config.narrationRateLimitPerMinute),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
