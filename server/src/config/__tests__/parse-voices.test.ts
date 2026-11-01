import { describe, expect, it } from 'vitest';
import { parseVoices } from '../parse-voices';

describe('parseVoices', () => {
  it('parses Label:id pairs in order (the first is the default)', () => {
    expect(parseVoices('Warm guide:abc123,Calm guide:def456')).toEqual([
      { id: 'abc123', label: 'Warm guide' },
      { id: 'def456', label: 'Calm guide' },
    ]);
  });

  it('trims spaces and skips empty parts', () => {
    expect(parseVoices(' Warm : abc ,, Calm:def , ')).toEqual([
      { id: 'abc', label: 'Warm' },
      { id: 'def', label: 'Calm' },
    ]);
  });

  it('splits at the last colon so labels may contain colons', () => {
    expect(parseVoices('Guide: Sam:abc')).toEqual([{ id: 'abc', label: 'Guide: Sam' }]);
  });

  it('accepts ids with letters, digits, underscores and hyphens', () => {
    expect(parseVoices('A:Abc_12-x')).toEqual([{ id: 'Abc_12-x', label: 'A' }]);
  });

  it.each([
    '',
    '   ',
    ',',
    'nocolon',
    ':abc',
    'Label:',
    'Label: ',
    'Label:bad id',
    'Label:bad/id',
    'Label:../etc',
    'Label:id?x=1',
    'Good:abc,broken',
    'Good:abc,:def',
  ])('returns null for %j', (text) => {
    expect(parseVoices(text)).toBeNull();
  });

  it('rejects ids longer than 64 characters', () => {
    expect(parseVoices(`A:${'x'.repeat(64)}`)).not.toBeNull();
    expect(parseVoices(`A:${'x'.repeat(65)}`)).toBeNull();
  });
});
