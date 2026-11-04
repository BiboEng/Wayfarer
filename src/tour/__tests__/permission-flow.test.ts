import type { LocationPermission } from '@/location/types';

import type { NotificationAccess, NotificationPermission } from '../notification/types';
import { createPermissionFlow, STALE, type PermissionHost } from '../permission-flow';
import type { SessionPhase } from '../tour-snapshot';

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

interface Options {
  location?: LocationPermission;
  servicesOn?: boolean;
  notification?: NotificationPermission;
  declined?: boolean;
  requestAnswer?: NotificationPermission | 'reject';
  noNotifications?: boolean;
  readFails?: boolean;
}

function setup(options: Options = {}) {
  let generation = 1;
  let phase: SessionPhase = 'needs-notifications';
  const host: jest.Mocked<PermissionHost> = {
    phase: jest.fn(() => phase),
    generation: jest.fn(() => generation),
    setPhase: jest.fn((next: SessionPhase) => {
      phase = next;
    }),
    cancel: jest.fn(),
    restart: jest.fn(),
  };
  const access: jest.Mocked<NotificationAccess> = {
    getPermission: jest.fn(async () => {
      if (options.readFails) throw new Error('boom');
      return options.notification ?? 'undetermined';
    }),
    request: jest.fn(async () => {
      if (options.requestAnswer === 'reject') throw new Error('prompt failed');
      return options.requestAnswer ?? 'granted';
    }),
    wasDeclined: jest.fn(async () => options.declined ?? false),
    rememberDeclined: jest.fn(async () => undefined),
  };
  const flow = createPermissionFlow(
    {
      getPermission: async () => options.location ?? 'granted',
      requestPermission: async () => 'granted',
      servicesEnabled: async () => options.servicesOn ?? true,
      notifications: options.noNotifications ? undefined : access,
    },
    host,
  );
  return { flow, host, access, bump: () => generation++, setPhase: (p: SessionPhase) => (phase = p) };
}

describe('check', () => {
  it('location granted + notifications undetermined -> needs-notifications', async () => {
    expect(await setup().flow.check(1, true)).toBe('needs-notifications');
  });

  it('declined or remembered -> straight to running (null)', async () => {
    expect(await setup({ declined: true }).flow.check(1, true)).toBeNull();
  });

  it('notifications granted or denied -> running', async () => {
    expect(await setup({ notification: 'granted' }).flow.check(1, true)).toBeNull();
    expect(await setup({ notification: 'denied' }).flow.check(1, true)).toBeNull();
  });

  it('askNotifications false skips the step without reading it', async () => {
    const t = setup();
    expect(await t.flow.check(1, false)).toBeNull();
    expect(t.access.getPermission).not.toHaveBeenCalled();
  });

  it('no notification dependency -> running', async () => {
    expect(await setup({ noNotifications: true }).flow.check(1, true)).toBeNull();
  });

  it('a failing read never blocks the tour', async () => {
    expect(await setup({ readFails: true }).flow.check(1, true)).toBeNull();
  });

  it('location problems come before notifications', async () => {
    expect(await setup({ location: 'denied' }).flow.check(1, true)).toBe('permission-denied');
    expect(await setup({ servicesOn: false }).flow.check(1, true)).toBe('location-off');
  });

  it('is STALE when a newer start overtook it', async () => {
    const t = setup();
    const pending = t.flow.check(1, true);
    t.bump();
    expect(await pending).toBe(STALE);
  });
});

describe('requestNotifications', () => {
  it('granted -> restarts without the notification step, nothing remembered', async () => {
    const t = setup({ requestAnswer: 'granted' });
    t.flow.requestNotifications();
    expect(t.flow.isAsking()).toBe(true);
    await flush();
    expect(t.flow.isAsking()).toBe(false);
    expect(t.host.restart).toHaveBeenCalledWith(false);
    expect(t.access.rememberDeclined).not.toHaveBeenCalled();
  });

  it.each(['denied', 'undetermined'] as const)('a refused prompt (%s) is remembered like "continue without"', async (answer) => {
    const t = setup({ requestAnswer: answer });
    t.flow.requestNotifications();
    await flush();
    expect(t.access.rememberDeclined).toHaveBeenCalledTimes(1);
    expect(t.host.restart).toHaveBeenCalledWith(false);
  });

  it('a prompt that throws counts as refused and still starts the tour', async () => {
    const t = setup({ requestAnswer: 'reject' });
    t.flow.requestNotifications();
    await flush();
    expect(t.access.rememberDeclined).toHaveBeenCalledTimes(1);
    expect(t.host.restart).toHaveBeenCalledWith(false);
  });

  it('a remember failure is swallowed', async () => {
    const t = setup({ requestAnswer: 'denied' });
    t.access.rememberDeclined.mockRejectedValue(new Error('disk'));
    t.flow.requestNotifications();
    await flush();
    expect(t.host.restart).toHaveBeenCalledWith(false);
  });

  it('does not restart when the tour was stopped while the prompt showed', async () => {
    const t = setup();
    t.flow.requestNotifications();
    t.bump();
    await flush();
    expect(t.host.restart).not.toHaveBeenCalled();
    expect(t.flow.isAsking()).toBe(false);
  });

  it('ignored outside the needs-notifications screen, or while another prompt shows', () => {
    const t = setup();
    t.setPhase('running');
    t.flow.requestNotifications();
    expect(t.access.request).not.toHaveBeenCalled();
    t.setPhase('needs-notifications');
    t.flow.requestNotifications();
    t.flow.requestNotifications();
    expect(t.access.request).toHaveBeenCalledTimes(1);
  });
});

describe('skipNotifications', () => {
  it('remembers and starts the tour without the step', () => {
    const t = setup();
    t.flow.skipNotifications();
    expect(t.access.rememberDeclined).toHaveBeenCalledTimes(1);
    expect(t.host.restart).toHaveBeenCalledWith(false);
  });

  it('ignored on other screens', () => {
    const t = setup();
    t.setPhase('needs-permission');
    t.flow.skipNotifications();
    expect(t.access.rememberDeclined).not.toHaveBeenCalled();
    expect(t.host.restart).not.toHaveBeenCalled();
  });
});

describe('requestLocation', () => {
  it('a grant restarts with the notification step enabled', async () => {
    const t = setup();
    t.flow.requestLocation();
    await flush();
    expect(t.host.restart).toHaveBeenCalledWith(true);
  });
});
