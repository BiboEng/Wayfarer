import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isValidBlobKey } from '../../cache/blob-store';
import { audioBlobKey, narrationCacheKey } from '../cache-key';
import { PROMPT_VERSION } from '../prompt';

const parts = { landmarkId: 'wiki:42764', travelMode: 'walking', length: 'medium' } as const;

describe('narrationCacheKey (the text key)', () => {
  it('includes the prompt version, so a better prompt starts fresh', () => {
    expect(narrationCacheKey(parts)).toContain(`:p${PROMPT_VERSION}:`);
  });

  it('is narration:p{version}:{landmarkId}:{travelMode}:{length}, with no voice', () => {
    expect(narrationCacheKey(parts)).toBe(`narration:p${PROMPT_VERSION}:wiki:42764:walking:medium`);
  });

  it('ignores a voice even if one is passed (one text serves every voice)', () => {
    const withVoice = { ...parts, voice: 'voiceA' } as typeof parts;
    expect(narrationCacheKey(withVoice)).toBe(narrationCacheKey(parts));
    expect(narrationCacheKey(withVoice)).not.toContain('voiceA');
  });

  it('is stable for the same input', () => {
    expect(narrationCacheKey(parts)).toBe(narrationCacheKey({ ...parts }));
  });

  it.each([
    ['landmark', { landmarkId: 'wiki:1' }],
    ['travel mode', { travelMode: 'driving' }],
    ['length', { length: 'long' }],
  ] as const)('differs when the %s differs', (_name, change) => {
    expect(narrationCacheKey({ ...parts, ...change })).not.toBe(narrationCacheKey(parts));
  });
});

describe('audioBlobKey (text + voice)', () => {
  it('is sha256(voice + newline + text) as 64 hex characters', () => {
    const expected = createHash('sha256').update('voiceA\nSome text').digest('hex');
    expect(audioBlobKey('Some text', 'voiceA')).toBe(expected);
    expect(isValidBlobKey(audioBlobKey('Some text', 'voiceA'))).toBe(true);
  });

  it('is stable for the same text and voice', () => {
    expect(audioBlobKey('text', 'voiceA')).toBe(audioBlobKey('text', 'voiceA'));
  });

  it('differs for another text or another voice', () => {
    expect(audioBlobKey('text A', 'voiceA')).not.toBe(audioBlobKey('text B', 'voiceA'));
    expect(audioBlobKey('text', 'voiceA')).not.toBe(audioBlobKey('text', 'voiceB'));
  });

  it('is the same for two narrations that end up with identical text (audio is shared)', () => {
    expect(audioBlobKey('Same story', 'voiceA')).toBe(audioBlobKey('Same story', 'voiceA'));
  });

  it('does not reveal the inputs', () => {
    expect(audioBlobKey('Hagia Sophia', 'voiceA')).not.toContain('voiceA');
  });
});
