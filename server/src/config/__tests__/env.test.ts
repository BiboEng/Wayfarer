import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '../env';

const TOKEN = 'a-valid-test-token-1234';
const CONTACT = 'test@example.com';
/** The smallest valid environment. */
const KEY = 'test-openrouter-key';
const BASE = { APP_TOKEN: TOKEN, UPSTREAM_CONTACT: CONTACT, OPENROUTER_API_KEY: KEY };

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
      openRouterApiKey: KEY,
      openRouterModel: 'google/gemini-2.5-flash-lite',
      ttsProvider: 'none',
      elevenLabs: null,
      dailyLlmCallCap: 300,
      dailyTtsCharCap: 5000,
      audioDir: null,
      narrationRateLimitPerMinute: 10,
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
      openRouterApiKey: KEY,
      openRouterModel: 'google/gemini-2.5-flash-lite',
      ttsProvider: 'none',
      elevenLabs: null,
      dailyLlmCallCap: 300,
      dailyTtsCharCap: 5000,
      audioDir: null,
      narrationRateLimitPerMinute: 10,
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
      const err = catchEnvError({ UPSTREAM_CONTACT: CONTACT, OPENROUTER_API_KEY: KEY });
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
      expect(catchEnvError({ APP_TOKEN: TOKEN, OPENROUTER_API_KEY: KEY }).variables).toEqual(['UPSTREAM_CONTACT']);
      expect(catchEnvError({ ...BASE, UPSTREAM_CONTACT: '' }).variables).toEqual(['UPSTREAM_CONTACT']);
      expect(catchEnvError({ ...BASE, UPSTREAM_CONTACT: '   ' }).variables).toEqual(['UPSTREAM_CONTACT']);
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

  describe('narration settings', () => {
    const EL = { ...BASE, TTS_PROVIDER: 'elevenlabs', ELEVENLABS_API_KEY: 'el-key', ELEVENLABS_VOICES: 'Warm:voiceA,Calm:voiceB' };

    it('requires OPENROUTER_API_KEY and treats empty or blank as missing', () => {
      const { OPENROUTER_API_KEY: _omit, ...without } = BASE;
      void _omit;
      expect(catchEnvError(without).variables).toEqual(['OPENROUTER_API_KEY']);
      expect(catchEnvError({ ...BASE, OPENROUTER_API_KEY: '' }).variables).toEqual(['OPENROUTER_API_KEY']);
      expect(catchEnvError({ ...BASE, OPENROUTER_API_KEY: '   ' }).variables).toEqual(['OPENROUTER_API_KEY']);
    });

    it('never puts the key in an error message', () => {
      const err = catchEnvError({ ...BASE, OPENROUTER_API_KEY: KEY, PORT: 'nope' });
      expect(err.message).not.toContain(KEY);
    });

    it('reads model, caps, audio dir and the narration rate limit', () => {
      const config = parseEnv({
        ...BASE,
        OPENROUTER_MODEL: 'vendor/model',
        DAILY_LLM_CALL_CAP: '5',
        DAILY_TTS_CHAR_CAP: '0',
        AUDIO_DIR: '/data/audio',
        NARRATION_RATE_LIMIT_PER_MINUTE: '3',
      });
      expect(config).toMatchObject({
        openRouterModel: 'vendor/model',
        dailyLlmCallCap: 5,
        dailyTtsCharCap: 0,
        audioDir: '/data/audio',
        narrationRateLimitPerMinute: 3,
      });
    });

    it('allows a cap of 0 but rejects negative or fractional caps', () => {
      expect(parseEnv({ ...BASE, DAILY_LLM_CALL_CAP: '0' }).dailyLlmCallCap).toBe(0);
      expect(catchEnvError({ ...BASE, DAILY_LLM_CALL_CAP: '-1' }).variables).toEqual(['DAILY_LLM_CALL_CAP']);
      expect(catchEnvError({ ...BASE, DAILY_TTS_CHAR_CAP: '1.5' }).variables).toEqual(['DAILY_TTS_CHAR_CAP']);
    });

    it('rejects a narration rate limit below 1', () => {
      expect(catchEnvError({ ...BASE, NARRATION_RATE_LIMIT_PER_MINUTE: '0' }).variables).toEqual([
        'NARRATION_RATE_LIMIT_PER_MINUTE',
      ]);
    });

    it('defaults TTS_PROVIDER to none and ignores ElevenLabs settings then', () => {
      const config = parseEnv({ ...BASE, ELEVENLABS_API_KEY: 'x', ELEVENLABS_VOICES: 'garbage' });
      expect(config.ttsProvider).toBe('none');
      expect(config.elevenLabs).toBeNull();
    });

    it('rejects an unknown TTS_PROVIDER', () => {
      expect(catchEnvError({ ...BASE, TTS_PROVIDER: 'openai' }).variables).toEqual(['TTS_PROVIDER']);
      expect(catchEnvError({ ...BASE, TTS_PROVIDER: 'robot' }).variables).toEqual(['TTS_PROVIDER']);
    });

    it('builds the ElevenLabs config when the key and voices are valid', () => {
      const config = parseEnv(EL);
      expect(config.ttsProvider).toBe('elevenlabs');
      expect(config.elevenLabs).toEqual({
        apiKey: 'el-key',
        voices: [
          { id: 'voiceA', label: 'Warm' },
          { id: 'voiceB', label: 'Calm' },
        ],
      });
    });

    it('requires ELEVENLABS_API_KEY when the provider is elevenlabs', () => {
      const { ELEVENLABS_API_KEY: _omit, ...without } = EL;
      void _omit;
      expect(catchEnvError(without).variables).toEqual(['ELEVENLABS_API_KEY']);
    });

    it('requires valid ELEVENLABS_VOICES when the provider is elevenlabs', () => {
      const { ELEVENLABS_VOICES: _omit, ...without } = EL;
      void _omit;
      expect(catchEnvError(without).variables).toEqual(['ELEVENLABS_VOICES']);
      expect(catchEnvError({ ...EL, ELEVENLABS_VOICES: 'no-colon' }).variables).toEqual(['ELEVENLABS_VOICES']);
      expect(catchEnvError({ ...EL, ELEVENLABS_VOICES: ' , ' }).variables).toEqual(['ELEVENLABS_VOICES']);
    });

    it('names both ElevenLabs variables when both are missing, and never leaks values', () => {
      const err = catchEnvError({ ...BASE, TTS_PROVIDER: 'elevenlabs' });
      expect([...err.variables].sort()).toEqual(['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICES']);
    });

    it('does not leak the ElevenLabs key when the voices are bad', () => {
      const err = catchEnvError({ ...EL, ELEVENLABS_API_KEY: 'super-secret-el-key', ELEVENLABS_VOICES: 'bad' });
      expect(err.message).not.toContain('super-secret-el-key');
    });
  });
});
