/**
 * The session's Phase 6 behaviour: end(), runsInBackground, background audio, notification step.
 */
import { DEFAULT_SETTINGS } from '@/settings/types';

import { createFakeLocationSource, walkingFix } from '../__fixtures__/fake-location';
import { createFakePlayer } from '../__fixtures__/fake-player';
import { narrationFor, offsetM, ORIGIN, place } from '../__fixtures__/places';
import { createTourSession, type TourSessionDeps } from '../create-tour-session';
import type { NotificationPermission } from '../notification/types';
import type { TourSource } from '../types';

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

function setup(opts: { simulated?: boolean; notification?: NotificationPermission; declined?: boolean } = {}) {
  const location = createFakeLocationSource();
  const fakePlayer = createFakePlayer();
  const clock = new Date(2026, 5, 10, 12, 0, 0).getTime();
  const reportBackground: ((runs: boolean) => void)[] = [];
  const landmarks = [place('A', offsetM(ORIGIN, 100))];
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  const notifications = {
    getPermission: jest.fn(async () => opts.notification ?? 'granted'),
    request: jest.fn(async () => 'granted' as NotificationPermission),
    wasDeclined: jest.fn(async () => opts.declined ?? false),
    rememberDeclined: jest.fn(async () => undefined),
  };
  const deps = {
    isSimulated: jest.fn((_s: TourSource) => opts.simulated ?? false),
    createLocationSource: jest.fn((_s: TourSource, onKnown: (runs: boolean) => void) => {
      reportBackground.push(onKnown);
      return location.source;
    }),
    getPermission: jest.fn(async () => 'granted' as const),
    requestPermission: jest.fn(async () => 'granted' as const),
    servicesEnabled: jest.fn(async () => true),
    notifications,
    api: {
      getNearbyLandmarks: jest.fn(async () => ok({ landmarks })),
      requestNarration: jest.fn(async (r: { landmarkId: string }) => ok(narrationFor(r.landmarkId))),
      getCue: jest.fn(async () => ({ ok: false as const, error: { code: 'NETWORK_ERROR' as const, message: 'x' } })),
    },
    audioSource: jest.fn((audio: { url: string }) => ({ uri: `https://api.test${audio.url}`, headers: {} })),
    player: fakePlayer.player,
    allowBackgroundAudio: jest.fn(),
    visitedStore: { load: jest.fn(async () => null), save: jest.fn() },
    getSettings: () => DEFAULT_SETTINGS,
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
    deps,
    notifications,
    changes,
    reportBackground,
    fix: (northM: number) => location.emit(walkingFix(northM, clock)),
    async begin() {
      session.start('gps');
      await flush();
    },
  };
}

const status = (t: ReturnType<typeof setup>) => t.session.getSnapshot().status;

describe('end()', () => {
  it('moves a running tour to ended and tears down like stop', async () => {
    const t = setup();
    await t.begin();
    t.fix(0);
    await flush();
    expect(t.played.length).toBeGreaterThan(0);
    t.session.end();
    expect(status(t)).toBe('ended');
    expect(t.location.source.stop).toHaveBeenCalledTimes(1);
    expect(t.location.isWatching()).toBe(false);
    expect(t.player.getState().status).toBe('idle');
    expect(t.deps.allowBackgroundAudio).toHaveBeenLastCalledWith(false);
    expect(t.session.getSnapshot().runsInBackground).toBeNull();
  });

  it('processes no more fixes after ending', async () => {
    const t = setup();
    await t.begin();
    t.session.end();
    const searches = t.deps.api.getNearbyLandmarks.mock.calls.length;
    const lateListener = (t.location.source.start as jest.Mock).mock.calls[0][1];
    lateListener(walkingFix(0, 1));
    await flush();
    expect(t.deps.api.getNearbyLandmarks.mock.calls.length).toBe(searches);
    expect(t.session.getSnapshot().position).toBeNull();
  });

  it('wakes listeners once', async () => {
    const t = setup();
    await t.begin();
    t.changes.mockClear();
    t.session.end();
    expect(t.changes).toHaveBeenCalledTimes(1);
  });

  it.each(['idle', 'ended'] as const)('is a no-op when not running (%s)', async (before) => {
    const t = setup();
    if (before === 'ended') {
      await t.begin();
      t.session.end();
    }
    t.changes.mockClear();
    t.deps.allowBackgroundAudio.mockClear();
    t.session.end();
    expect(status(t)).toBe(before);
    expect(t.changes).not.toHaveBeenCalled();
    expect(t.deps.allowBackgroundAudio).not.toHaveBeenCalled();
  });

  it('is a no-op on a waiting screen (the notification step)', async () => {
    const t = setup({ notification: 'undetermined' });
    await t.begin();
    expect(status(t)).toBe('needs-notifications');
    t.session.end();
    expect(status(t)).toBe('needs-notifications');
  });

  it('start() after ended runs a fresh tour', async () => {
    const t = setup();
    await t.begin();
    t.session.end();
    await t.begin();
    expect(status(t)).toBe('listening');
    expect(t.location.isWatching()).toBe(true);
    expect(t.deps.allowBackgroundAudio).toHaveBeenLastCalledWith(true);
    t.fix(0);
    await flush();
    expect(t.session.getSnapshot().position).not.toBeNull();
  });

  it('stop() after ended goes back to idle', async () => {
    const t = setup();
    await t.begin();
    t.session.end();
    t.session.stop();
    expect(status(t)).toBe('idle');
  });
});

describe('background audio flag', () => {
  it('is on while running and off after stop', async () => {
    const t = setup();
    await t.begin();
    expect(t.deps.allowBackgroundAudio).toHaveBeenLastCalledWith(true);
    t.session.stop();
    expect(t.deps.allowBackgroundAudio).toHaveBeenLastCalledWith(false);
  });
});

describe('runsInBackground', () => {
  it('is null until the location source reports, then follows it', async () => {
    const t = setup();
    await t.begin();
    expect(t.session.getSnapshot().runsInBackground).toBeNull();
    t.reportBackground[0](true);
    expect(t.session.getSnapshot().runsInBackground).toBe(true);
  });

  it('reports false when the source fell back to the watch', async () => {
    const t = setup();
    await t.begin();
    t.reportBackground[0](false);
    expect(t.session.getSnapshot().runsInBackground).toBe(false);
  });

  it('a report wakes listeners; the same report again does not', async () => {
    const t = setup();
    await t.begin();
    t.changes.mockClear();
    t.reportBackground[0](true);
    expect(t.changes).toHaveBeenCalledTimes(1);
    t.reportBackground[0](true);
    expect(t.changes).toHaveBeenCalledTimes(1);
  });

  it('a simulated route is false right away', async () => {
    const t = setup({ simulated: true });
    t.session.start('sim-walk');
    await flush();
    expect(t.session.getSnapshot().runsInBackground).toBe(false);
  });

  it('resets after stop and ignores a late report from the old tour', async () => {
    const t = setup();
    await t.begin();
    t.reportBackground[0](true);
    t.session.stop();
    expect(t.session.getSnapshot().runsInBackground).toBeNull();
    t.reportBackground[0](true);
    expect(t.session.getSnapshot().runsInBackground).toBeNull();
  });
});

describe('notification step', () => {
  it('undetermined and not declined shows needs-notifications without tracking', async () => {
    const t = setup({ notification: 'undetermined' });
    await t.begin();
    expect(status(t)).toBe('needs-notifications');
    expect(t.deps.createLocationSource).not.toHaveBeenCalled();
  });

  it('declined before goes straight to the tour', async () => {
    const t = setup({ notification: 'undetermined', declined: true });
    await t.begin();
    expect(status(t)).toBe('listening');
    expect(t.notifications.request).not.toHaveBeenCalled();
  });

  it('skipNotifications remembers and starts the tour', async () => {
    const t = setup({ notification: 'undetermined' });
    await t.begin();
    t.session.skipNotifications();
    await flush();
    expect(t.notifications.rememberDeclined).toHaveBeenCalledTimes(1);
    expect(status(t)).toBe('listening');
  });

  it('requestNotifications prompts (only from the tap) and starts whatever the answer', async () => {
    const t = setup({ notification: 'undetermined' });
    t.notifications.request.mockResolvedValue('denied');
    await t.begin();
    expect(t.notifications.request).not.toHaveBeenCalled();
    t.session.requestNotifications();
    await flush();
    expect(t.notifications.rememberDeclined).toHaveBeenCalledTimes(1);
    expect(status(t)).toBe('listening');
  });

  it('a simulated route skips the notification step', async () => {
    const t = setup({ simulated: true, notification: 'undetermined' });
    t.session.start('sim-walk');
    await flush();
    expect(status(t)).toBe('listening');
  });
});
