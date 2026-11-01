import type { ClientError } from '@/api/client';

/** A short, friendly line for a failed landmark search. */
export function searchErrorMessage(error: ClientError): string {
  switch (error.code) {
    case 'NOT_CONFIGURED':
    case 'NETWORK_ERROR':
      return "Couldn't reach the Wayfarer server.";
    case 'TIMEOUT':
      return 'The search took too long. Try again.';
    case 'UPSTREAM_FAILED':
      return 'The landmark search failed. Try again.';
    case 'RATE_LIMITED':
      return 'Too many requests. Wait a moment and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

/** Why a story can't be played, and whether trying again could help. */
export function narrationErrorMessage(error: ClientError): { message: string; retryable: boolean } {
  switch (error.code) {
    case 'NOT_NARRATABLE':
    case 'NOT_FOUND':
      return { message: 'No story available for this place.', retryable: false };
    case 'RATE_LIMITED':
      return { message: 'Too many stories in a short time. Wait a moment and try again.', retryable: true };
    case 'NOT_CONFIGURED':
    case 'NETWORK_ERROR':
      return { message: "Couldn't reach the Wayfarer server.", retryable: true };
    default:
      return { message: "Couldn't get the story. Try again.", retryable: true };
  }
}
