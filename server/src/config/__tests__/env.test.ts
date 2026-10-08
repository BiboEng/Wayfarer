import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '../env';

const TOKEN = 'a-valid-test-token-1234';

function catchEnvError(source: Record<string, string | undefined>): EnvError {
  try {
    parseEnv(source);
  } catch (err) {
    expect(err).toBeInstanceOf(EnvError);
    return err as EnvError;
  }
  throw new Error('expected parseEnv to throw');
}

describe('parseEnv', () => {
  it('applies defaults when only APP_TOKEN is set', () => {
    expect(parseEnv({ APP_TOKEN: TOKEN })).toEqual({
      port: 3000,
      host: '0.0.0.0',
      appToken: TOKEN,
      rateLimitPerMinute: 60,
      trustProxy: 0,
    });
  });

  it('coerces numeric strings to numbers', () => {
    const config = parseEnv({
      APP_TOKEN: TOKEN,
      PORT: '8080',
      HOST: '127.0.0.1',
      RATE_LIMIT_PER_MINUTE: '120',
      TRUST_PROXY: '1',
    });
    expect(config).toEqual({
      port: 8080,
      host: '127.0.0.1',
      appToken: TOKEN,
      rateLimitPerMinute: 120,
      trustProxy: 1,
    });
  });

  it('treats empty strings as unset so defaults apply', () => {
    const config = parseEnv({
      APP_TOKEN: TOKEN,
      PORT: '',
      HOST: '',
      RATE_LIMIT_PER_MINUTE: '',
      TRUST_PROXY: '',
    });
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.rateLimitPerMinute).toBe(60);
    expect(config.trustProxy).toBe(0);
  });

  it('ignores unrelated variables', () => {
    expect(parseEnv({ APP_TOKEN: TOKEN, PATH: '/usr/bin', OPENROUTER_API_KEY: 'x' }).appToken).toBe(TOKEN);
  });

  it('accepts a token of exactly 16 characters', () => {
    expect(parseEnv({ APP_TOKEN: 'a'.repeat(16) }).appToken).toBe('a'.repeat(16));
  });

  describe('errors', () => {
    it('throws EnvError naming APP_TOKEN when it is missing', () => {
      const err = catchEnvError({});
      expect(err.variables).toEqual(['APP_TOKEN']);
      expect(err.message).toContain('APP_TOKEN');
    });

    it('treats an empty APP_TOKEN as missing', () => {
      expect(catchEnvError({ APP_TOKEN: '' }).variables).toEqual(['APP_TOKEN']);
    });

    it('rejects a short token without leaking its value', () => {
      const shortToken = 'short-secret-15c'.slice(0, 15);
      const err = catchEnvError({ APP_TOKEN: shortToken });
      expect(err.variables).toEqual(['APP_TOKEN']);
      expect(err.message).toContain('APP_TOKEN');
      expect(err.message).not.toContain(shortToken);
    });

    it.each(['abc', '0', '65536', '-1', '3000.5', 'NaN'])('rejects PORT=%s without leaking the value', (port) => {
      const err = catchEnvError({ APP_TOKEN: TOKEN, PORT: port });
      expect(err.variables).toEqual(['PORT']);
      expect(err.message).toContain('PORT');
      expect(err.message).not.toContain(`: ${port}`);
      expect(err.message).not.toContain(TOKEN);
    });

    it('rejects out-of-range RATE_LIMIT_PER_MINUTE and TRUST_PROXY', () => {
      const err = catchEnvError({ APP_TOKEN: TOKEN, RATE_LIMIT_PER_MINUTE: '0', TRUST_PROXY: '-1' });
      expect([...err.variables].sort()).toEqual(['RATE_LIMIT_PER_MINUTE', 'TRUST_PROXY']);
    });

    it('names every bad variable once and never includes any value', () => {
      const badToken = 'tooshort-secret';
      const badPort = 'not-a-port-xyz';
      const err = catchEnvError({ APP_TOKEN: badToken, PORT: badPort });
      expect([...err.variables].sort()).toEqual(['APP_TOKEN', 'PORT']);
      expect(err.message).toContain('APP_TOKEN');
      expect(err.message).toContain('PORT');
      expect(err.message).not.toContain(badToken);
      expect(err.message).not.toContain(badPort);
    });

    it('has the name EnvError', () => {
      expect(catchEnvError({}).name).toBe('EnvError');
    });
  });
});
