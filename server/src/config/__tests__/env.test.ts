import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '../env';

const TOKEN = 'a-valid-test-token-1234';
const CONTACT = 'test@example.com';
/** The smallest valid environment. */
const BASE = { APP_TOKEN: TOKEN, UPSTREAM_CONTACT: CONTACT };

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
  it('applies defaults when only the required variables are set', () => {
    expect(parseEnv(BASE)).toEqual({
      port: 3000,
      host: '0.0.0.0',
      appToken: TOKEN,
      rateLimitPerMinute: 60,
      trustProxy: 0,
      contact: CONTACT,
      cachePath: null,
      overpassUrl: 'https://overpass-api.de/api/interpreter',
    });
  });

  it('coerces numeric strings to numbers', () => {
    const config = parseEnv({
      ...BASE,
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
      contact: CONTACT,
      cachePath: null,
      overpassUrl: 'https://overpass-api.de/api/interpreter',
    });
  });

  it('treats empty strings as unset so defaults apply', () => {
    const config = parseEnv({
      ...BASE,
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
    expect(parseEnv({ ...BASE, PATH: '/usr/bin', OPENROUTER_API_KEY: 'x' }).appToken).toBe(TOKEN);
  });

  it('accepts a token of exactly 16 characters', () => {
    expect(parseEnv({ ...BASE, APP_TOKEN: 'a'.repeat(16) }).appToken).toBe('a'.repeat(16));
  });

  describe('errors', () => {
    it('throws EnvError naming APP_TOKEN when it is missing', () => {
      const err = catchEnvError({ UPSTREAM_CONTACT: CONTACT });
      expect(err.variables).toEqual(['APP_TOKEN']);
      expect(err.message).toContain('APP_TOKEN');
    });

    it('treats an empty APP_TOKEN as missing', () => {
      expect(catchEnvError({ ...BASE, APP_TOKEN: '' }).variables).toEqual(['APP_TOKEN']);
    });

    it('rejects a short token without leaking its value', () => {
      const shortToken = 'short-secret-15c'.slice(0, 15);
      const err = catchEnvError({ ...BASE, APP_TOKEN: shortToken });
      expect(err.variables).toEqual(['APP_TOKEN']);
      expect(err.message).toContain('APP_TOKEN');
      expect(err.message).not.toContain(shortToken);
    });

    it.each(['abc', '0', '65536', '-1', '3000.5', 'NaN'])('rejects PORT=%s without leaking the value', (port) => {
      const err = catchEnvError({ ...BASE, PORT: port });
      expect(err.variables).toEqual(['PORT']);
      expect(err.message).toContain('PORT');
      expect(err.message).not.toContain(`: ${port}`);
      expect(err.message).not.toContain(TOKEN);
    });

    it('rejects out-of-range RATE_LIMIT_PER_MINUTE and TRUST_PROXY', () => {
      const err = catchEnvError({ ...BASE, RATE_LIMIT_PER_MINUTE: '0', TRUST_PROXY: '-1' });
      expect([...err.variables].sort()).toEqual(['RATE_LIMIT_PER_MINUTE', 'TRUST_PROXY']);
    });

    it('names every bad variable once and never includes any value', () => {
      const badToken = 'tooshort-secret';
      const badPort = 'not-a-port-xyz';
      const err = catchEnvError({ ...BASE, APP_TOKEN: badToken, PORT: badPort });
      expect([...err.variables].sort()).toEqual(['APP_TOKEN', 'PORT']);
      expect(err.message).toContain('APP_TOKEN');
      expect(err.message).toContain('PORT');
      expect(err.message).not.toContain(badToken);
      expect(err.message).not.toContain(badPort);
    });

    it('requires UPSTREAM_CONTACT and treats an empty one as missing', () => {
      expect(catchEnvError({ APP_TOKEN: TOKEN }).variables).toEqual(['UPSTREAM_CONTACT']);
      expect(catchEnvError({ APP_TOKEN: TOKEN, UPSTREAM_CONTACT: '' }).variables).toEqual(['UPSTREAM_CONTACT']);
      expect(catchEnvError({ APP_TOKEN: TOKEN, UPSTREAM_CONTACT: '   ' }).variables).toEqual(['UPSTREAM_CONTACT']);
    });

    it('rejects an invalid OVERPASS_URL', () => {
      expect(catchEnvError({ ...BASE, OVERPASS_URL: 'not a url' }).variables).toEqual(['OVERPASS_URL']);
    });

    it('has the name EnvError', () => {
      expect(catchEnvError({}).name).toBe('EnvError');
    });
  });

  describe('optional landmark settings', () => {
    it('reads CACHE_PATH and OVERPASS_URL when set', () => {
      const config = parseEnv({ ...BASE, CACHE_PATH: './data/cache.db', OVERPASS_URL: 'https://overpass.example.org/api/interpreter' });
      expect(config.cachePath).toBe('./data/cache.db');
      expect(config.overpassUrl).toBe('https://overpass.example.org/api/interpreter');
    });

    it('trims the contact', () => {
      expect(parseEnv({ ...BASE, UPSTREAM_CONTACT: '  me@example.com ' }).contact).toBe('me@example.com');
    });

    it('treats an empty CACHE_PATH as unset', () => {
      expect(parseEnv({ ...BASE, CACHE_PATH: '' }).cachePath).toBeNull();
    });
  });
});
