import { APP_TOKEN_HEADER } from '@shared/api/endpoints';
import type { NarrationAudio } from '@shared/api/narration';

import { buildAudioSource } from '../narration-audio';

const AUDIO: NarrationAudio = { url: '/narrations/audio/abc123', contentType: 'audio/mpeg' };

describe('buildAudioSource', () => {
  it('joins the base URL and the relative audio path', () => {
    const source = buildAudioSource({ baseUrl: 'https://api.example.test', appToken: 'tok' }, AUDIO);
    expect(source?.uri).toBe('https://api.example.test/narrations/audio/abc123');
  });

  it('sends the app token under the shared header name', () => {
    const source = buildAudioSource({ baseUrl: 'https://api.example.test', appToken: 'tok' }, AUDIO);
    expect(source?.headers).toEqual({ [APP_TOKEN_HEADER]: 'tok' });
  });

  it('returns null without a server URL', () => {
    expect(buildAudioSource({ baseUrl: null, appToken: 'tok' }, AUDIO)).toBeNull();
  });

  it('treats an empty base URL as no server', () => {
    expect(buildAudioSource({ baseUrl: '', appToken: 'tok' }, AUDIO)).toBeNull();
  });

  it('keeps a base URL with a port', () => {
    const source = buildAudioSource({ baseUrl: 'http://10.0.2.2:8787', appToken: 't' }, AUDIO);
    expect(source?.uri).toBe('http://10.0.2.2:8787/narrations/audio/abc123');
  });
});
