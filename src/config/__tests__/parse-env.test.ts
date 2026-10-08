import { parseAppEnv } from '../parse-env';

describe('parseAppEnv', () => {
  describe('apiUrl', () => {
    it.each([
      ['http://localhost:3000', 'http://localhost:3000'],
      ['https://api.example.com', 'https://api.example.com'],
      ['HTTPS://API.example.com', 'HTTPS://API.example.com'],
      ['http://192.168.1.10:3000/base', 'http://192.168.1.10:3000/base'],
    ])('accepts %s', (input, expected) => {
      expect(parseAppEnv({ apiUrl: input }).apiUrl).toBe(expected);
    });

    it('strips trailing slashes', () => {
      expect(parseAppEnv({ apiUrl: 'https://api.example.com/' }).apiUrl).toBe('https://api.example.com');
      expect(parseAppEnv({ apiUrl: 'https://api.example.com///' }).apiUrl).toBe('https://api.example.com');
      expect(parseAppEnv({ apiUrl: 'https://api.example.com/v1/' }).apiUrl).toBe('https://api.example.com/v1');
    });

    it('trims surrounding whitespace', () => {
      expect(parseAppEnv({ apiUrl: '  https://api.example.com/  ' }).apiUrl).toBe('https://api.example.com');
    });

    it.each([
      ['undefined', undefined],
      ['empty', ''],
      ['whitespace only', '   '],
      ['garbage', 'not a url'],
      ['no scheme', 'api.example.com'],
      ['ftp scheme', 'ftp://example.com'],
      ['file scheme', 'file:///etc/passwd'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['scheme only', 'https://'],
      ['scheme then slash', 'https:///path'],
      ['scheme with space host', 'http:// example.com'],
    ])('returns null for %s', (_label, input) => {
      expect(parseAppEnv({ apiUrl: input }).apiUrl).toBeNull();
    });

    it('returns null when the key is missing entirely', () => {
      expect(parseAppEnv({}).apiUrl).toBeNull();
    });
  });

  describe('appToken', () => {
    it('trims the token', () => {
      expect(parseAppEnv({ appToken: '  abc123  ' }).appToken).toBe('abc123');
    });

    it('returns an empty string when missing', () => {
      expect(parseAppEnv({}).appToken).toBe('');
      expect(parseAppEnv({ appToken: undefined }).appToken).toBe('');
    });

    it('returns an empty string for whitespace-only input', () => {
      expect(parseAppEnv({ appToken: '   ' }).appToken).toBe('');
    });
  });
});
