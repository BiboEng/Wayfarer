import { introOutputFor } from '../intro-output';
import type { PlayableNarration } from '../types';

const AUDIO = { uri: 'https://x.test/a', headers: {} };
const base: PlayableNarration = { id: 'n', title: 't', text: 'Main text.', audio: AUDIO };

describe('introOutputFor', () => {
  it('is null without an intro', () => {
    expect(introOutputFor(base)).toBeNull();
    expect(introOutputFor({ ...base, audio: null })).toBeNull();
  });

  it('main audio + intro audio -> the intro plays as audio', () => {
    expect(introOutputFor({ ...base, intro: { text: 'Coming up ahead.', audio: AUDIO } })).toBe('audio');
  });

  it('main audio + intro without audio -> no intro (skipped)', () => {
    expect(introOutputFor({ ...base, intro: { text: 'Coming up ahead.', audio: null } })).toBeNull();
  });

  it('main on the device voice -> the device speaks the intro text, even if intro audio exists', () => {
    expect(introOutputFor({ ...base, audio: null, intro: { text: 'Coming up ahead.', audio: null } })).toBe('device-voice');
    expect(introOutputFor({ ...base, audio: null, intro: { text: 'Coming up ahead.', audio: AUDIO } })).toBe('device-voice');
  });

  it('main on the device voice + an empty intro text -> no intro', () => {
    expect(introOutputFor({ ...base, audio: null, intro: { text: '   ', audio: null } })).toBeNull();
  });
});
