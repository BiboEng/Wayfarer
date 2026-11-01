import type { NextFunction, Request, Response } from 'express';

/** Aborts when the client disconnects before the response finished. */
export function abortOnDisconnect(res: Response): AbortController {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller;
}

export type GuardedHandler = (req: Request, res: Response, signal: AbortSignal) => Promise<void>;

/** Wraps an async handler: gives it a disconnect signal and forwards errors to Express. */
export function guarded(handler: GuardedHandler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const controller = abortOnDisconnect(res);
    try {
      await handler(req, res, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return; // client is gone; nothing to report
      next(err);
    }
  };
}
