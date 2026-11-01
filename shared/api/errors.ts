export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'NOT_FOUND',
  /** 422: the landmark has no Wikipedia text to ground a narration in. */
  'NOT_NARRATABLE',
  'RATE_LIMITED',
  'UPSTREAM_FAILED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Body of every non-2xx server response. `message` is safe to show or log. */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    (ERROR_CODES as readonly unknown[]).includes(error.code) &&
    typeof error.message === 'string'
  );
}
