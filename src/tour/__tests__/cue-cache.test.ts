import type { CueResponse } from '@shared/api/cues';
import type { NarrationAudio } from '@shared/api/narration';
import { ORIENTATION_CUE_TEXT } from '@shared/narration/cues';

import type { ApiResult } from '@/api/client';
import type { RemoteSound } from '@/audio/types';

import { createCueCache } from '../cue-cache';
import type { Side } from '../types';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const cueResponse = (cue: Side, withAudio = true): ApiResult<CueResponse> => ({
  ok: true,
  data: { cue, text: ORIENTATION_CUE_TEXT[cue], audio: withAudio ? { url: `/narrations/audio/cue-${cue}`, contentType: 'audio/mpeg' } : null },
});
const failure: ApiResult<CueResponse> = { ok: false, error: { code: 'NETWORK_ERROR', message: 'offline' } };

const audioSource = (audio: NarrationAudio): RemoteSound => ({ uri: `https://api.test${audio.url}`, headers: { 'x-test': '1' } });

function setup(reply: (cue: Side, voice: string | null | undefined) => Promise<ApiResult<CueResponse>> = async (cue) => cueResponse(cue)) {
  const getCue = jest.fn(reply);
  const source = jest.fn(audioSource);
  return { cache: createCueCache({ getCue, audioSource: source }), getCue, source };
}

describe('createCueCache', () => {
  it('returns the plain text at once when the line is not cached yet (never waits)', () => {
    const { cache, getCue } = setup();
    expect(cache.introFor('left', 'v1')).toEqual({ text: 'Coming up on your left.', audio: null });
    expect(getCue).toHaveBeenCalledTimes(1);
    expect(getCue).toHaveBeenCalledWith('left', 'v1');
  });

  it('returns the cached line with audio once it has arrived', async () => {
    const { cache } = setup();
    cache.introFor('right', null);
    await flush();
    expect(cache.introFor('right', null)).toEqual({
      text: 'Coming up on your right.',
      audio: { uri: 'https://api.test/narrations/audio/cue-right', headers: { 'x-test': '1' } },
    });
  });

  it('does not ask twice for a line that is on its way or cached', async () => {
    const { cache, getCue } = setup();
    cache.introFor('ahead', 'v1');
    cache.introFor('ahead', 'v1');
    expect(getCue).toHaveBeenCalledTimes(1);
    await flush();
    cache.introFor('ahead', 'v1');
    expect(getCue).toHaveBeenCalledTimes(1);
  });

  it('keeps lines per voice', async () => {
    const { cache, getCue } = setup();
    cache.introFor('left', 'v1');
    cache.introFor('left', 'v2');
    cache.introFor('left', null);
    expect(getCue).toHaveBeenCalledTimes(3);
    await flush();
    expect(cache.introFor('left', 'v1').audio).not.toBeNull();
  });

  it('warm fetches the three lines once', async () => {
    const { cache, getCue } = setup();
    cache.warm('v1');
    cache.warm('v1');
    expect(getCue.mock.calls.map(([cue]) => cue).sort()).toEqual(['ahead', 'left', 'right']);
    await flush();
    cache.warm('v1');
    expect(getCue).toHaveBeenCalledTimes(3);
  });

  it('a failed request is not cached: the next story asks again, and gets text only meanwhile', async () => {
    const replies = [failure, cueResponse('left')];
    const { cache, getCue } = setup(async () => replies.shift() ?? failure);
    expect(cache.introFor('left', null).audio).toBeNull();
    await flush();
    expect(cache.introFor('left', null)).toEqual({ text: 'Coming up on your left.', audio: null });
    expect(getCue).toHaveBeenCalledTimes(2);
    await flush();
    expect(cache.introFor('left', null).audio).not.toBeNull();
  });

  it('a request that throws is treated as a failure', async () => {
    const { cache, getCue } = setup(() => Promise.reject(new Error('boom')));
    expect(() => cache.introFor('left', null)).not.toThrow();
    await flush();
    expect(cache.introFor('left', null).audio).toBeNull();
    expect(getCue).toHaveBeenCalledTimes(2);
  });

  it('a line the server sent without audio gives text only (device voice)', async () => {
    const { cache, source } = setup(async (cue) => cueResponse(cue, false));
    cache.introFor('ahead', null);
    await flush();
    expect(cache.introFor('ahead', null)).toEqual({ text: 'Coming up ahead.', audio: null });
    expect(source).not.toHaveBeenCalled();
  });

  it('audio that cannot be built (no server URL) gives text only', async () => {
    const getCue = jest.fn(async (cue: Side) => cueResponse(cue));
    const cache = createCueCache({ getCue, audioSource: () => null });
    cache.introFor('ahead', null);
    await flush();
    expect(cache.introFor('ahead', null).audio).toBeNull();
  });

  it('cancelPending ignores requests still on their way, and keeps lines already cached', async () => {
    const { cache, getCue } = setup();
    cache.introFor('right', null);
    await flush(); // right is cached
    cache.introFor('left', null); // in flight
    cache.cancelPending();
    await flush();
    // The cached line survives.
    expect(cache.introFor('right', null).audio).not.toBeNull();
    // The old answer for "left" was ignored, so the line is asked for again.
    expect(cache.introFor('left', null).audio).toBeNull();
    expect(getCue.mock.calls.filter(([cue]) => cue === 'left')).toHaveLength(2);
  });
});
