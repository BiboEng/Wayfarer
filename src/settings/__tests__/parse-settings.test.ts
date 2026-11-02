import { parseSettings } from '../parse-settings';
import { DEFAULT_SETTINGS } from '../types';

describe('parseSettings', () => {
  it('reads valid saved settings', () => {
    expect(parseSettings('{"voice":"v-1","length":"long","travelMode":"driving"}')).toEqual({
      voice: 'v-1',
      length: 'long',
      travelMode: 'driving',
    });
  });

  it('accepts "auto" as the travel mode', () => {
    expect(parseSettings('{"voice":null,"length":"short","travelMode":"auto"}').travelMode).toBe('auto');
  });

  it.each([null, undefined, '', 'not json', '{', '[1,2]', '"text"', '42', 'null', 'true'])('falls back to the defaults for %p', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns a copy, never the shared defaults object', () => {
    const result = parseSettings(null);
    expect(result).not.toBe(DEFAULT_SETTINGS);
    result.length = 'long';
    expect(DEFAULT_SETTINGS.length).toBe('medium');
  });

  it('one bad field does not reset the others', () => {
    expect(parseSettings('{"voice":"v-1","length":"enormous","travelMode":"walking"}')).toEqual({
      voice: 'v-1',
      length: DEFAULT_SETTINGS.length,
      travelMode: 'walking',
    });
    expect(parseSettings('{"voice":"v-1","length":"short","travelMode":"flying"}')).toEqual({
      voice: 'v-1',
      length: 'short',
      travelMode: DEFAULT_SETTINGS.travelMode,
    });
    expect(parseSettings('{"voice":5,"length":"short","travelMode":"walking"}')).toEqual({
      voice: DEFAULT_SETTINGS.voice,
      length: 'short',
      travelMode: 'walking',
    });
  });

  it('missing fields use the defaults', () => {
    expect(parseSettings('{"length":"long"}')).toEqual({ ...DEFAULT_SETTINGS, length: 'long' });
    expect(parseSettings('{}')).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects an empty or oversized voice id', () => {
    expect(parseSettings('{"voice":""}').voice).toBeNull();
    expect(parseSettings(JSON.stringify({ voice: 'x'.repeat(101) })).voice).toBeNull();
    expect(parseSettings(JSON.stringify({ voice: 'x'.repeat(100) })).voice).toBe('x'.repeat(100));
  });

  it('ignores unknown extra fields', () => {
    expect(parseSettings('{"voice":"v","length":"short","travelMode":"auto","extra":1}')).toEqual({
      voice: 'v',
      length: 'short',
      travelMode: 'auto',
    });
  });
});
