import { ERROR_CODES } from '@shared/api/errors';

import type { ClientErrorCode } from '@/api/client';

import { narrationErrorMessage, searchErrorMessage } from '../error-message';
import { error } from '../__fixtures__/explore-fixtures';

const ALL_CODES: ClientErrorCode[] = [...ERROR_CODES, 'NOT_CONFIGURED', 'NETWORK_ERROR', 'TIMEOUT', 'BAD_RESPONSE'];

describe('searchErrorMessage', () => {
  it.each(ALL_CODES)('gives a non-empty message for %s', (code) => {
    expect(searchErrorMessage(error(code)).length).toBeGreaterThan(0);
  });

  it('never shows the raw technical message', () => {
    expect(searchErrorMessage(error('NETWORK_ERROR'))).not.toContain('test NETWORK_ERROR');
  });

  it('tells a network failure, a timeout and a rate limit apart', () => {
    const messages = new Set((['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED'] as const).map((code) => searchErrorMessage(error(code))));
    expect(messages.size).toBe(3);
  });
});

describe('narrationErrorMessage', () => {
  it.each(['NOT_NARRATABLE', 'NOT_FOUND'] as const)('%s is not retryable', (code) => {
    expect(narrationErrorMessage(error(code)).retryable).toBe(false);
  });

  it.each(['NETWORK_ERROR', 'NOT_CONFIGURED', 'RATE_LIMITED', 'TIMEOUT', 'UPSTREAM_FAILED', 'BAD_RESPONSE'] as const)(
    '%s is retryable with a message',
    (code) => {
      const result = narrationErrorMessage(error(code));
      expect(result.retryable).toBe(true);
      expect(result.message.length).toBeGreaterThan(0);
    },
  );

  it.each(ALL_CODES)('gives a non-empty message for %s', (code) => {
    expect(narrationErrorMessage(error(code)).message.length).toBeGreaterThan(0);
  });
});
