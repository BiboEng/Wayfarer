import { ERROR_CODES, isApiError } from '../errors';

describe('isApiError', () => {
  it.each(ERROR_CODES)('accepts a well-formed error with code %s', (code) => {
    expect(isApiError({ error: { code, message: 'something' } })).toBe(true);
  });

  it('accepts an empty message string', () => {
    expect(isApiError({ error: { code: 'INTERNAL', message: '' } })).toBe(true);
  });

  it('accepts extra fields', () => {
    expect(isApiError({ error: { code: 'NOT_FOUND', message: 'x', extra: 1 }, other: true })).toBe(true);
  });

  it('rejects an unknown error code', () => {
    expect(isApiError({ error: { code: 'TEAPOT', message: 'x' } })).toBe(false);
  });

  it('rejects client-only codes that are not part of the server contract', () => {
    expect(isApiError({ error: { code: 'NETWORK_ERROR', message: 'x' } })).toBe(false);
  });

  it('rejects lowercase codes', () => {
    expect(isApiError({ error: { code: 'not_found', message: 'x' } })).toBe(false);
  });

  it('rejects wrong field types', () => {
    expect(isApiError({ error: { code: 404, message: 'x' } })).toBe(false);
    expect(isApiError({ error: { code: 'INTERNAL', message: 42 } })).toBe(false);
    expect(isApiError({ error: { code: 'INTERNAL', message: null } })).toBe(false);
    expect(isApiError({ error: 'INTERNAL' })).toBe(false);
    expect(isApiError({ error: 5 })).toBe(false);
    expect(isApiError({ error: null })).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(isApiError({ error: { code: 'INTERNAL' } })).toBe(false);
    expect(isApiError({ error: { message: 'x' } })).toBe(false);
    expect(isApiError({ error: {} })).toBe(false);
    expect(isApiError({})).toBe(false);
    expect(isApiError({ code: 'INTERNAL', message: 'x' })).toBe(false);
  });

  it.each([null, undefined, 'error', 42, true, [], () => undefined])('rejects non-object %p', (value) => {
    expect(isApiError(value)).toBe(false);
  });
});
