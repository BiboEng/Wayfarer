import type { NarrationAudio, NarrationRequest } from '@shared/api/narration';

import type { RemoteSound } from '@/audio/types';
import { DEFAULT_SETTINGS, type TourSettings } from '@/settings/types';

import { narrationFor, ORIGIN, place } from '../__fixtures__/places';
import type { CueCache } from '../cue-cache';
import type { PlayerLink } from '../player-link';
import { createCommandRunner, type TourApi } from '../tour-commands';
import type { TourEvent } from '../tour-machine-types';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const A = place('A', ORIGIN);
const failure = (code: 'NETWORK_ERROR' | 'UPSTREAM_FAILED' = 'NETWORK_ERROR') => ({ ok: false as const, error: { code, message: `secret-looking ${code}` } });

function setup(settings: TourSettings = DEFAULT_SETTINGS) {
  const api = {
    getNearbyLandmarks: jest.fn<ReturnType<TourApi['getNearbyLandmarks']>, Parameters<TourApi['getNearbyLandmarks']>>(),
    requestNarration: jest.fn<ReturnType<TourApi['requestNarration']>, Parameters<TourApi['requestNarration']>>(),
    getCue: jest.fn<ReturnType<TourApi['getCue']>, Parameters<TourApi['getCue']>>(),
  };
  const link: jest.Mocked<PlayerLink> = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    play: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn(() => false),
  };
  const cues: jest.Mocked<CueCache> = { introFor: jest.fn(), warm: jest.fn(), cancelPending: jest.fn() };
  const visitedStore = { load: jest.fn(), save: jest.fn() };
  const log = jest.fn();
  const sound: RemoteSound = { uri: 'https://api.test/x', headers: {} };
  const audioSource = jest.fn((_audio: NarrationAudio): RemoteSound | null => sound);
  const run = createCommandRunner({ api, audioSource, link, cues, visitedStore, getSettings: () => settings, log });
  const events: TourEvent[] = [];
  const dispatch = (event: TourEvent) => events.push(event);
  return { api, link, cues, visitedStore, log, audioSource, run, events, dispatch, sound };
}

describe('fetchNearby', () => {
  it('turns a result into NEARBY_RESULT with the request id', async () => {
    const { api, run, events, dispatch } = setup();
    api.getNearbyLandmarks.mockResolvedValue({ ok: true, data: { landmarks: [A], center: ORIGIN, radiusMeters: 200 } as never });
    run({ type: 'fetchNearby', requestId: 4, center: ORIGIN, radiusM: 200 }, dispatch);
    await flush();
    expect(api.getNearbyLandmarks).toHaveBeenCalledWith(ORIGIN, 200);
    expect(events).toEqual([{ type: 'NEARBY_RESULT', requestId: 4, landmarks: [A] }]);
  });

  it('turns an error result into NEARBY_FAILED and logs only the error code', async () => {
    const { api, run, events, dispatch, log } = setup();
    api.getNearbyLandmarks.mockResolvedValue(failure('UPSTREAM_FAILED'));
    run({ type: 'fetchNearby', requestId: 4, center: ORIGIN, radiusM: 200 }, dispatch);
    await flush();
    expect(events).toEqual([{ type: 'NEARBY_FAILED', requestId: 4 }]);
    expect(log).toHaveBeenCalledWith(expect.any(String), 'UPSTREAM_FAILED');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-looking');
  });

  it('turns a rejected promise into NEARBY_FAILED (no unhandled rejection)', async () => {
    const { api, run, events, dispatch } = setup();
    api.getNearbyLandmarks.mockRejectedValue(new Error('boom'));
    run({ type: 'fetchNearby', requestId: 4, center: ORIGIN, radiusM: 200 }, dispatch);
    await flush();
    expect(events).toEqual([{ type: 'NEARBY_FAILED', requestId: 4 }]);
  });
});

describe('fetchNarration / prefetch', () => {
  it.each(['fetchNarration', 'prefetch'] as const)('%s requests the story with the settings of the moment', async (type) => {
    const settings: TourSettings = { voice: 'v-9', length: 'long', travelMode: 'auto' };
    const { api, run, events, dispatch } = setup(settings);
    api.requestNarration.mockResolvedValue({ ok: true, data: narrationFor('A') });
    run({ type, requestId: 7, landmarkId: 'A', travelMode: 'driving' }, dispatch);
    await flush();
    const expected: NarrationRequest = { landmarkId: 'A', length: 'long', travelMode: 'driving', voice: 'v-9' };
    expect(api.requestNarration).toHaveBeenCalledWith(expected);
    expect(events).toEqual([{ type: 'NARRATION_READY', requestId: 7, narration: narrationFor('A') }]);
  });

  it('leaves out the voice when none is chosen (server default)', () => {
    const { api, run, dispatch } = setup({ ...DEFAULT_SETTINGS, voice: null });
    api.requestNarration.mockResolvedValue({ ok: true, data: narrationFor('A') });
    run({ type: 'fetchNarration', requestId: 1, landmarkId: 'A', travelMode: 'walking' }, dispatch);
    expect(api.requestNarration.mock.calls[0][0]).not.toHaveProperty('voice');
  });

  it('reads the settings when it runs, so a change applies to the next story', () => {
    let settings: TourSettings = { ...DEFAULT_SETTINGS, length: 'short' };
    const base = setup();
    const run = createCommandRunner({
      api: base.api,
      audioSource: base.audioSource,
      link: base.link,
      cues: base.cues,
      visitedStore: base.visitedStore,
      getSettings: () => settings,
      log: base.log,
    });
    base.api.requestNarration.mockResolvedValue({ ok: true, data: narrationFor('A') });
    run({ type: 'fetchNarration', requestId: 1, landmarkId: 'A', travelMode: 'walking' }, base.dispatch);
    settings = { ...settings, length: 'long' };
    run({ type: 'fetchNarration', requestId: 2, landmarkId: 'A', travelMode: 'walking' }, base.dispatch);
    expect(base.api.requestNarration.mock.calls.map(([request]) => request.length)).toEqual(['short', 'long']);
  });

  it('turns an error into NARRATION_FAILED, quietly', async () => {
    const { api, run, events, dispatch, log } = setup();
    api.requestNarration.mockResolvedValue(failure());
    run({ type: 'fetchNarration', requestId: 7, landmarkId: 'A', travelMode: 'walking' }, dispatch);
    await flush();
    expect(events).toEqual([{ type: 'NARRATION_FAILED', requestId: 7 }]);
    expect(log).toHaveBeenCalledWith(expect.any(String), 'NETWORK_ERROR');
  });

  it('turns a rejected promise into NARRATION_FAILED', async () => {
    const { api, run, events, dispatch } = setup();
    api.requestNarration.mockRejectedValue(new Error('boom'));
    run({ type: 'prefetch', requestId: 7, landmarkId: 'A', travelMode: 'walking' }, dispatch);
    await flush();
    expect(events).toEqual([{ type: 'NARRATION_FAILED', requestId: 7 }]);
  });
});

describe('play', () => {
  const narration = narrationFor('A');
  const command = (side: 'ahead' | 'left' | 'right' | null, n = narration) => ({
    type: 'play' as const,
    narrationId: 'tour:1:A',
    landmark: A,
    narration: n,
    side,
  });

  it('hands the story to the player with its audio source and no intro when there is no side', () => {
    const { run, link, dispatch, sound, cues } = setup();
    run(command(null), dispatch);
    expect(link.play).toHaveBeenCalledWith({ id: 'tour:1:A', title: 'Place A', text: narration.text, audio: sound });
    expect(cues.introFor).not.toHaveBeenCalled();
  });

  it('adds the orientation line for the chosen voice when there is a side', () => {
    const { run, link, dispatch, cues } = setup({ ...DEFAULT_SETTINGS, voice: 'v-2' });
    const intro = { text: 'Coming up on your left.', audio: null };
    cues.introFor.mockReturnValue(intro);
    run(command('left'), dispatch);
    expect(cues.introFor).toHaveBeenCalledWith('left', 'v-2');
    expect(link.play.mock.calls[0][0].intro).toBe(intro);
  });

  it('plays with the device voice when the narration has no audio', () => {
    const { run, link, dispatch, audioSource } = setup();
    run(command(null, narrationFor('A', { audio: null })), dispatch);
    expect(link.play.mock.calls[0][0].audio).toBeNull();
    expect(audioSource).not.toHaveBeenCalled();
  });

  it('plays with the device voice when the audio source cannot be built', () => {
    const { run, link, dispatch, audioSource } = setup();
    audioSource.mockReturnValue(null);
    run(command(null), dispatch);
    expect(link.play.mock.calls[0][0].audio).toBeNull();
  });
});

describe('player and storage commands', () => {
  it('forwards stop, pause and resume to the link', () => {
    const { run, link, dispatch } = setup();
    run({ type: 'stopPlayback' }, dispatch);
    run({ type: 'pausePlayback' }, dispatch);
    run({ type: 'resumePlayback' }, dispatch);
    expect(link.stop).toHaveBeenCalledTimes(1);
    expect(link.pause).toHaveBeenCalledTimes(1);
    expect(link.resume).toHaveBeenCalledTimes(1);
  });

  it('saves the visited list', () => {
    const { run, visitedStore, dispatch } = setup();
    const day = { date: '2026-06-10', ids: ['A'] };
    run({ type: 'saveVisited', day }, dispatch);
    expect(visitedStore.save).toHaveBeenCalledWith(day);
  });

  it('does not dispatch anything for commands that have no answer', () => {
    const { run, events, dispatch } = setup();
    run({ type: 'stopPlayback' }, dispatch);
    run({ type: 'saveVisited', day: { date: '2026-06-10', ids: [] } }, dispatch);
    expect(events).toEqual([]);
  });
});
