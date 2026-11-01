import type { ErrorCode } from '@shared/api/errors';

const STATUS: Partial<Record<ErrorCode, number>> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  NOT_NARRATABLE: 422,
};

/** A narration request that cannot be served, for a reason the client should see. */
export class NarrationError extends Error {
  readonly code: 'BAD_REQUEST' | 'NOT_FOUND' | 'NOT_NARRATABLE';

  constructor(code: NarrationError['code'], message: string) {
    super(message);
    this.name = 'NarrationError';
    this.code = code;
  }

  get status(): number {
    return STATUS[this.code] ?? 400;
  }
}
