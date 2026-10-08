import { describe, expect, it } from 'vitest';
import { tokensMatch } from '../app-token';

const EXPECTED = 'correct-horse-battery-staple';

describe('tokensMatch', () => {
  it('returns false when no token is provided', () => {
    expect(tokensMatch(undefined, EXPECTED)).toBe(false);
  });

  it('returns false for an empty token', () => {
    expect(tokensMatch('', EXPECTED)).toBe(false);
  });

  it('returns false for a wrong token of the same length', () => {
    expect(tokensMatch('x'.repeat(EXPECTED.length), EXPECTED)).toBe(false);
  });

  it('returns false for a different-length token (shorter, longer, prefix)', () => {
    expect(tokensMatch('short', EXPECTED)).toBe(false);
    expect(tokensMatch(`${EXPECTED}-extra`, EXPECTED)).toBe(false);
    expect(tokensMatch(EXPECTED.slice(0, -1), EXPECTED)).toBe(false);
  });

  it('is case sensitive', () => {
    expect(tokensMatch(EXPECTED.toUpperCase(), EXPECTED)).toBe(false);
  });

  it('does not trim whitespace', () => {
    expect(tokensMatch(` ${EXPECTED}`, EXPECTED)).toBe(false);
  });

  it('returns true for the right token', () => {
    expect(tokensMatch(EXPECTED, EXPECTED)).toBe(true);
  });

  it('handles non-ASCII tokens without throwing', () => {
    expect(tokensMatch('tökén-ключ-令牌', 'tökén-ключ-令牌')).toBe(true);
    expect(tokensMatch('tökén-ключ-令牌', 'token-ключ-令牌')).toBe(false);
  });
});
