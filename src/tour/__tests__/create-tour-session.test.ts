/**
 * The tour wired together with fakes: location source, API, player, storage and clock.
 * No timers or network: every answer is resolved by hand.
 */
import type { CueResponse } from '@shared/api/cues';
import type { NarrationResponse } from '@shared/api/narration';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import { ORIENTATION_CUE_TEXT } from '@shared/narration/cues';

import type { ApiResult } from '@/api/client';
import type { LocationPermission } from '@/location/types';
import { DEFAULT_SETTINGS, type TourSettings } from '@/settings/types';

import { createFakeLocationSource, walkingFix } from '../__fixtures__/fake-location';
import { createFakePlayer } from '../__fixtures__/fake-player';
import { narrationFor, offsetM, ORIGIN, place } from '../__fixtures__/places';
import { createTourSession, type TourSessionDeps } from '../create-tour-session';
import type { TourSource } from '../types';
import type { VisitedStore } from '../visited-storage';

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const fail = (): ApiResult<never> => ({ ok: false, error: { code: 'NETWORK_ERROR', message: 'offline' } });

interface Options {
  permission?: LocationPermission;
  servicesOn?: boolean;
  requestAnswer?: LocationPermission;
  landmarks?: Landmark[];
  settings?: TourSettings;
  simulated?: boolean;
  storedVisited?: { date: string; ids: string[] } | null;
}

function setup(options: Options = {}) {
  const location = createFakeLocationSource();
  const fakePlayer = createFakePlayer();
  let clock = new Date(2026, 5, 10, 12, 0, 0).getTime();
  let landmarks = options.landmarks ?? [];
  let permission: LocationPermission = options.permission ?? 'granted';
  let settings = options.settings ?? DEFAULT_SETTINGS;
  const settingsListeners = new Set<() => void>();

  const api = {
    getNearbyLandmarks: jest.fn(async (_center: LatLng, _radiusM: number) => ok({ landmarks })),
    requestNarration: jest.fn(async (request: { landmarkId: string }): Promise<ApiResult<NarrationResponse>> => ok(narrationFor(request.landmarkId))),
    getCue: jest.fn(async (cue: 'ahead' | 'left' | 'right', _voice?: string | null): Promise<ApiResult<CueResponse>> =>
      ok({ cue, text: ORIENTATION_CUE_TEXT[cue], audio: { url: `/narrations/audio/cue-${cue}`, contentType: 'audio/mpeg' } }),
    ),
  };
  const visitedStore: jest.Mocked<VisitedStore> = {
    load: jest.fn(async () => options.storedVisited ?? null),
    save: jest.fn(),
  };
  const deps = {
    isSimulated: jest.fn((_source: TourSource) => options.simulated ?? false),
    createLocationSource: jest.fn((_source: TourSource) => location.source),
    getPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => {
      permission = options.requestAnswer ?? 'granted';
      return permission;
    }),
    servicesEnabled: jest.fn(async () => options.servicesOn ?? true),
    api,
    audioSource: jest.fn((audio: { url: string }) => ({ uri: `https://api.test${audio.url}`, headers: {} })),
    player: fakePlayer.player,
    visitedStore,
    getSettings: () => settings,
    subscribeSettings: jest.fn((listener: () => void) => {
      settingsListeners.add(listener);
      return () => {
        settingsListeners.delete(listener);
      };
    }),
    now: () => clock,
    log: jest.fn(),
  } satisfies TourSessionDeps;
  const session = createTourSession(deps);
  const changes = jest.fn();
  session.subscribe(changes);

  return {
    ...fakePlayer,
    session,
    location,
    api,
    deps,
    visitedStore,
    changes,
    changeSettings: (patch: Partial<TourSettings>) => {
      settings = { ...settings, ...patch };
      settingsListeners.forEach((listener) => listener());
    },
    settingsListenerCount: () => settingsListeners.size,
    setLandmarks: (next: Landmark[]) => {
      landmarks = next;
    },
    tick: (ms: number) => {
      clock += ms;
      return clock;
    },
    /** A fix `northM` north of ORIGIN, stamped with the current clock. */
    fixAt: (northM: number) => location.emit(walkingFix(northM, clock)),
    /** Starts GPS and waits until tracking is on. */
    async begin(source: TourSource = 'gps') {
      session.start(source);
      await flush();
    },
  };
}

const A = place('A', offsetM(ORIGIN, 100));
const B = place('B', offsetM(ORIGIN, 190));
const status = (ctx: ReturnType<typeof setup>) => ctx.session.getSnapshot().status;

describe('permission and location states (no prompt without a tap)', () => {
  it('needs-permission when location was never asked: does not prompt or track', async () => {
    const ctx = setup({ permission: 'undetermined' });
    await ctx.begin();
    expect(status(ctx)).toBe('needs-permission');
    expect(ctx.deps.requestPermission).not.toHaveBeenCalled();
    expect(ctx.deps.createLocationSource).not.toHaveBeenCalled();
  });

  it('permission-denied when refused for good: does not prompt or track', async () => {
    const ctx = setup({ permission: 'denied' });
    await ctx.begin();
    expect(status(ctx)).toBe('permission-denied');
    expect(ctx.deps.requestPermission).not.toHaveBeenCalled();
    expect(ctx.deps.createLocationSource).not.toHaveBeenCalled();
  });

  it('location-off when the phone has location services off: does not prompt or track', async () => {
    const ctx = setup({ servicesOn: false });
    await ctx.begin();
    expect(status(ctx)).toBe('location-off');
    expect(ctx.deps.requestPermission).not.toHaveBeenCalled();
    expect(ctx.deps.createLocationSource).not.toHaveBeenCalled();
  });

  it('requestPermission (a tap) shows the prompt and starts when granted', async () => {
    const ctx = setup({ permission: 'undetermined', requestAnswer: 'granted' });
    await ctx.begin();
    ctx.session.requestPermission();
    await flush();
    expect(ctx.deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(ctx.deps.createLocationSource).toHaveBeenCalledTimes(1);
    expect(status(ctx)).toBe('listening');
  });

  it('requestPermission refused -> permission-denied, no tracking', async () => {
    const ctx = setup({ permission: 'undetermined', requestAnswer: 'denied' });
    await ctx.begin();
    ctx.session.requestPermission();
    await flush();
    expect(status(ctx)).toBe('permission-denied');
    expect(ctx.deps.createLocationSource).not.toHaveBeenCalled();
  });

  it('a simulated route needs no permission', async () => {
    const ctx = setup({ permission: 'denied', simulated: true });
    await ctx.begin('sim-walk');
    expect(ctx.deps.getPermission).not.toHaveBeenCalled();
    expect(status(ctx)).toBe('listening');
    expect(ctx.session.getSnapshot().source).toBe('sim-walk');
  });

  it('stopping while the permission check is pending does not start tracking', async () => {
    const ctx = setup();
    ctx.session.start('gps');
    ctx.session.stop();
    await flush();
    expect(ctx.deps.createLocationSource).not.toHaveBeenCalled();
    expect(status(ctx)).toBe('idle');
  });
});

describe('an end-to-end run', () => {
  it('searches, tells the best place, then the next one only after the first ended', async () => {
    const ctx = setup({ landmarks: [A, B] });
    await ctx.begin();
    expect(status(ctx)).toBe('listening');
    expect(ctx.location.optionHistory[0]).toMatchObject({ accuracy: 'high', distanceIntervalM: 10, timeIntervalMs: 3000 });

    ctx.fixAt(0);
    await flush();
    expect(ctx.api.getNearbyLandmarks).toHaveBeenCalledWith({ lat: ORIGIN.lat, lng: ORIGIN.lng }, 200);
    expect(ctx.played.map((n) => n.id)).toEqual(['tour:1:A']);
    expect(status(ctx)).toBe('narrating');
    expect(ctx.session.getSnapshot().current?.landmark.id).toBe('A');

    // B was pre-fetched; while A plays, B waits.
    expect(ctx.api.requestNarration.mock.calls.map(([r]) => r.landmarkId)).toEqual(['A', 'B']);
    ctx.started(); // the sound starts
    await flush();
    expect(ctx.played).toHaveLength(1);

    ctx.finish();
    expect(ctx.played.map((n) => n.id)).toEqual(['tour:1:A', 'tour:2:B']);
    // No new request was made for B.
    expect(ctx.api.requestNarration).toHaveBeenCalledTimes(2);
    expect(ctx.interruptions).toEqual([]);
    expect(ctx.session.getSnapshot().history.map((h) => h.landmark.id)).toEqual(['B', 'A']);

    ctx.finish();
    expect(status(ctx)).toBe('listening');
    expect(ctx.played).toHaveLength(2);
  });

  it('plays the story without an intro when the heading is not known yet', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.played[0].intro).toBeUndefined();
    expect(ctx.session.getSnapshot().current?.side).toBeNull();
  });

  it('adds "Coming up ..." in the same voice once there is a heading', async () => {
    const ctx = setup({ landmarks: [A], settings: { ...DEFAULT_SETTINGS, voice: 'v-1' } });
    await ctx.begin();
    expect(ctx.api.getCue).toHaveBeenCalledTimes(3); // warmed for the voice
    expect(ctx.api.getCue).toHaveBeenCalledWith('left', 'v-1');
    await flush();
    ctx.fixAt(-40);
    ctx.tick(10_000);
    ctx.fixAt(-10); // 30 m north: heading 0
    await flush();
    expect(ctx.session.getSnapshot().headingDeg).toBeCloseTo(0, 0);
    expect(ctx.played).toHaveLength(1);
    expect(ctx.played[0].intro).toEqual({
      text: 'Coming up ahead.',
      audio: { uri: 'https://api.test/narrations/audio/cue-ahead', headers: {} },
    });
  });

  it('is silent with nothing nearby: no story request, no playback', async () => {
    const ctx = setup({ landmarks: [] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.api.requestNarration).not.toHaveBeenCalled();
    expect(ctx.played).toEqual([]);
    expect(status(ctx)).toBe('listening');
  });

  it('is silent for places already on today\'s visited list', async () => {
    const ctx = setup({ landmarks: [A], storedVisited: { date: '2026-06-10', ids: ['A'] } });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.api.requestNarration).not.toHaveBeenCalled();
  });

  it('saves the visited list as stories start', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.visitedStore.save).toHaveBeenCalledWith({ date: '2026-06-10', ids: ['A'] });
  });

  it('a failed search and a failed story request are skipped quietly and retried at the next check', async () => {
    const ctx = setup({ landmarks: [A] });
    ctx.api.getNearbyLandmarks.mockResolvedValueOnce(fail());
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.played).toEqual([]);
    expect(status(ctx)).toBe('listening');

    ctx.api.requestNarration.mockResolvedValueOnce(fail());
    ctx.fixAt(70); // next check
    await flush();
    expect(ctx.played).toEqual([]);
    expect(status(ctx)).toBe('listening');

    ctx.fixAt(140); // next check again: retried
    await flush();
    expect(ctx.played.map((n) => n.id)).toEqual(['tour:1:A']);
  });

  it('a request that throws does not break the tour', async () => {
    const ctx = setup({ landmarks: [A] });
    ctx.api.getNearbyLandmarks.mockRejectedValueOnce(new Error('boom'));
    await ctx.begin();
    expect(() => ctx.fixAt(0)).not.toThrow();
    await flush();
    expect(ctx.played).toEqual([]);
  });

  it('pause holds the next story; resume releases it', async () => {
    const ctx = setup({ landmarks: [A, B] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    ctx.started();
    ctx.session.pause();
    expect(status(ctx)).toBe('paused');
    expect(ctx.player.getState().status).toBe('paused');
    ctx.session.resume();
    expect(ctx.player.getState().status).toBe('playing');
    expect(status(ctx)).toBe('narrating');
  });

  it('skip moves on to the next place without repeating the skipped one', async () => {
    const ctx = setup({ landmarks: [A, B] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    ctx.session.skip();
    await flush();
    expect(ctx.played.map((n) => n.id)).toEqual(['tour:1:A', 'tour:2:B']);
    expect(ctx.interruptions).toEqual(['tour:1:A']); // the user's own skip
  });

  it('replay plays a history item again now, without an intro', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    ctx.finish();
    ctx.session.replay('A');
    expect(ctx.played.map((n) => n.id)).toEqual(['tour:1:A', 'tour:2:A']);
    expect(ctx.played[1].intro).toBeUndefined();
    expect(ctx.session.getSnapshot().history).toHaveLength(1);
  });

  it('does not touch a narration that is not the tour\'s', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.playOther('explore:1');
    ctx.session.skip();
    ctx.session.pause();
    expect(ctx.player.getState().narrationId).toBe('explore:1');
    expect(ctx.player.getState().status).toBe('loading');
  });
});

describe('stop', () => {
  it('stops tracking, the tour\'s story, and goes idle', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    ctx.session.stop();
    expect(ctx.location.source.stop).toHaveBeenCalled();
    expect(ctx.player.getState().status).toBe('idle');
    expect(ctx.listenerCount()).toBe(0);
    expect(status(ctx)).toBe('idle');
    expect(ctx.session.getSnapshot().history).toEqual([]);
    expect(ctx.session.getSnapshot().current).toBeNull();
  });

  it('answers that arrive after stop change nothing and start nothing', async () => {
    const ctx = setup({ landmarks: [A] });
    let resolveStory: (value: ApiResult<NarrationResponse>) => void = () => undefined;
    ctx.api.requestNarration.mockImplementationOnce(() => new Promise((resolve) => (resolveStory = resolve)));
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(status(ctx)).toBe('preparing');

    ctx.session.stop();
    ctx.changes.mockClear();
    resolveStory(ok(narrationFor('A')));
    await flush();

    expect(ctx.played).toEqual([]);
    expect(ctx.changes).not.toHaveBeenCalled();
    expect(status(ctx)).toBe('idle');
  });

  it('fixes and player events after stop change nothing', async () => {
    const ctx = setup({ landmarks: [A, B] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    const watcher = (ctx.location.source.start as jest.Mock).mock.calls[0][1];
    ctx.session.stop();
    ctx.changes.mockClear();
    const before = ctx.session.getSnapshot();

    ctx.location.emitLate(walkingFix(500, 0), watcher); // a late callback from the platform
    ctx.playOther('explore:1');
    ctx.finish();
    await flush();

    expect(ctx.session.getSnapshot()).toBe(before);
    expect(ctx.changes).not.toHaveBeenCalled();
    expect(ctx.api.requestNarration).toHaveBeenCalledTimes(2); // A and the pre-fetch of B, nothing after stop
  });

  it('commands after stop do nothing', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.session.stop();
    ctx.session.pause();
    ctx.session.skip();
    ctx.session.replay('A');
    ctx.session.resume();
    expect(status(ctx)).toBe('idle');
    expect(ctx.played).toEqual([]);
  });

  it('can start again after stopping (a fresh tour)', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    ctx.session.stop();
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(status(ctx)).toBe('narrating');
    expect(ctx.deps.createLocationSource).toHaveBeenCalledTimes(2);
  });
});

describe('travel mode and tracking', () => {
  it('the Settings override wins: driving settings use the driving radius and tracking options', async () => {
    const ctx = setup({ landmarks: [], settings: { ...DEFAULT_SETTINGS, travelMode: 'driving' } });
    await ctx.begin();
    expect(ctx.location.optionHistory[0]).toMatchObject({ distanceIntervalM: 30, timeIntervalMs: 5000 });
    ctx.fixAt(0);
    await flush();
    expect(ctx.api.getNearbyLandmarks).toHaveBeenCalledWith(expect.anything(), 800);
    expect(ctx.session.getSnapshot()).toMatchObject({ mode: 'driving', modeFixed: true });
  });

  it('auto mode starts walking and is not fixed', async () => {
    const ctx = setup();
    await ctx.begin();
    expect(ctx.session.getSnapshot()).toMatchObject({ mode: 'walking', modeFixed: false });
  });

  it('switches the watch to driving options after sustained speed', async () => {
    const ctx = setup();
    await ctx.begin();
    for (let i = 0; i < 25; i++) {
      ctx.location.emit(walkingFix(i * 12, ctx.tick(1000), { speedMps: 12 }));
      await flush();
    }
    expect(ctx.session.getSnapshot().mode).toBe('driving');
    expect(ctx.location.source.setOptions).toHaveBeenCalledWith(expect.objectContaining({ distanceIntervalM: 30, timeIntervalMs: 5000 }));
  });
});

describe('subscribe', () => {
  it('notifies only when what the screen shows changes', async () => {
    const ctx = setup({ landmarks: [] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    ctx.changes.mockClear();
    ctx.fixAt(0); // same position, nothing new to show
    expect(ctx.changes).not.toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', async () => {
    const ctx = setup();
    const extra = jest.fn();
    const off = ctx.session.subscribe(extra);
    off();
    await ctx.begin();
    expect(extra).not.toHaveBeenCalled();
  });
});

describe('permission states (more)', () => {
  it('location-approximate when only approximate location was allowed: no prompt, no tracking', async () => {
    const ctx = setup({ permission: 'approximate' });
    await ctx.begin();
    expect(status(ctx)).toBe('location-approximate');
    expect(ctx.deps.requestPermission).not.toHaveBeenCalled();
    expect(ctx.deps.createLocationSource).not.toHaveBeenCalled();
  });

  it('start is checked again on every start, so coming back from the phone settings works', async () => {
    const ctx = setup({ permission: 'denied' });
    await ctx.begin();
    expect(status(ctx)).toBe('permission-denied');
    ctx.session.stop();
    await ctx.begin();
    expect(ctx.deps.getPermission).toHaveBeenCalledTimes(2);
  });

  it('start is a no-op while the system prompt is open (its answer must not be discarded)', async () => {
    const ctx = setup({ permission: 'undetermined' });
    let answer: (value: 'granted') => void = () => undefined;
    ctx.deps.requestPermission.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await ctx.begin();
    ctx.session.requestPermission();
    ctx.session.requestPermission(); // a second tap changes nothing
    expect(ctx.deps.requestPermission).toHaveBeenCalledTimes(1);

    ctx.session.start('gps'); // e.g. the screen re-focused as the dialog closed
    await flush();
    expect(ctx.deps.getPermission).toHaveBeenCalledTimes(1);

    ctx.deps.getPermission.mockResolvedValue('granted'); // the system now reports the grant
    answer('granted');
    await flush();
    expect(ctx.deps.createLocationSource).toHaveBeenCalledTimes(1);
    expect(status(ctx)).toBe('listening');
  });
});

describe('inaccurate fixes', () => {
  it('a fix worse than 100 m (walking) moves the map dot but does not steer the tour', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.location.emit(walkingFix(0, 1000, { accuracyM: 250 }));
    await flush();
    expect(ctx.api.getNearbyLandmarks).not.toHaveBeenCalled();
    expect(ctx.session.getSnapshot().position).toEqual({ lat: ORIGIN.lat, lng: ORIGIN.lng });
    expect(ctx.played).toEqual([]);
  });

  it('a good fix after rough ones starts the tour as usual', async () => {
    const ctx = setup({ landmarks: [A] });
    await ctx.begin();
    ctx.location.emit(walkingFix(0, 1000, { accuracyM: 250 }));
    ctx.location.emit(walkingFix(0, 2000, { accuracyM: 10 }));
    await flush();
    expect(ctx.api.getNearbyLandmarks).toHaveBeenCalledTimes(1);
    expect(ctx.played).toHaveLength(1);
  });

  it('rough fixes do not count towards heading or mode', async () => {
    const ctx = setup();
    await ctx.begin();
    ctx.location.emit(walkingFix(0, 1000, { accuracyM: 10 }));
    ctx.location.emit(walkingFix(500, 2000, { accuracyM: 300 })); // would be a 500 m jump
    await flush();
    expect(ctx.session.getSnapshot().headingDeg).toBeNull();
  });
});

describe('settings and cues', () => {
  it('a Settings change to the travel mode applies at once, without waiting for a fix', async () => {
    const ctx = setup({ landmarks: [] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.session.getSnapshot().mode).toBe('walking');
    ctx.changeSettings({ travelMode: 'driving' });
    await flush();
    expect(ctx.session.getSnapshot()).toMatchObject({ mode: 'driving', modeFixed: true });
    expect(ctx.api.getNearbyLandmarks).toHaveBeenLastCalledWith(expect.anything(), 800);
    expect(ctx.location.source.setOptions).toHaveBeenCalledWith(expect.objectContaining({ distanceIntervalM: 30 }));
  });

  it('a voice change fetches the orientation lines of the new voice', async () => {
    const ctx = setup();
    await ctx.begin();
    ctx.api.getCue.mockClear();
    ctx.changeSettings({ voice: 'v-new' });
    expect(ctx.api.getCue).toHaveBeenCalledTimes(3);
    expect(ctx.api.getCue).toHaveBeenCalledWith('left', 'v-new');
  });

  it('the lines are kept across tours: a second tour does not fetch them again', async () => {
    const ctx = setup();
    await ctx.begin();
    await flush();
    expect(ctx.api.getCue).toHaveBeenCalledTimes(3);
    ctx.session.stop();
    await ctx.begin();
    await flush();
    expect(ctx.api.getCue).toHaveBeenCalledTimes(3);
  });

  it('stop unsubscribes from Settings', async () => {
    const ctx = setup();
    await ctx.begin();
    expect(ctx.settingsListenerCount()).toBe(1);
    ctx.session.stop();
    expect(ctx.settingsListenerCount()).toBe(0);
  });
});

describe('a failed playback', () => {
  it('moves on but waits for the next check before starting another story', async () => {
    const ctx = setup({ landmarks: [A, B] });
    await ctx.begin();
    ctx.fixAt(0);
    await flush();
    expect(ctx.played).toHaveLength(1);
    ctx.fail();
    expect(ctx.played).toHaveLength(1); // B is held
    ctx.fixAt(70); // next check
    await flush();
    expect(ctx.played.map((n) => n.id)).toEqual(['tour:1:A', 'tour:2:B']);
  });
});
