import { offsetM, ORIGIN, place } from '../../__fixtures__/places';
import type { TourSnapshot } from '../../types';
import { startNotificationController } from '../notification-controller';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

const landmark = (name: string) => place(name, offsetM(ORIGIN, 10), { name });

function setup(initial: Partial<TourSnapshot> = { status: 'idle' }) {
  let snapshot = initial as TourSnapshot;
  const listeners = new Set<() => void>();
  const session = {
    getSnapshot: () => snapshot,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  const show = jest.fn(async (_content: unknown) => undefined);
  const dismiss = jest.fn(async () => undefined);
  const log = jest.fn();
  const set = (next: Partial<TourSnapshot>) => {
    snapshot = next as TourSnapshot;
    listeners.forEach((l) => l());
  };
  const stopFollowing = () => startNotificationController({ session, show, dismiss, log });
  return { show, dismiss, log, set, start: stopFollowing, listenerCount: () => listeners.size };
}

describe('startNotificationController', () => {
  it('posts nothing while no tour runs', async () => {
    const t = setup();
    t.start();
    await flush();
    expect(t.show).not.toHaveBeenCalled();
    expect(t.dismiss).not.toHaveBeenCalled();
  });

  it('posts when the tour starts running', async () => {
    const t = setup();
    t.start();
    t.set({ status: 'listening', current: null });
    await flush();
    expect(t.show).toHaveBeenCalledTimes(1);
    expect(t.show).toHaveBeenCalledWith(expect.objectContaining({ body: 'Listening for places nearby', category: 'tour_playing' }));
  });

  it('posts right away when already running at start', async () => {
    const t = setup({ status: 'listening', current: null });
    t.start();
    await flush();
    expect(t.show).toHaveBeenCalledTimes(1);
  });

  it('re-posts only on change (status or place)', async () => {
    const t = setup({ status: 'listening', current: null });
    t.start();
    t.set({ status: 'listening', current: null, position: ORIGIN });
    t.set({ status: 'listening', current: null, headingDeg: 5 });
    await flush();
    expect(t.show).toHaveBeenCalledTimes(1);

    const a = { landmark: landmark('A'), side: 'ahead' as const, text: '' };
    t.set({ status: 'preparing', current: a });
    t.set({ status: 'narrating', current: { ...a, text: 'story' } }); // same words
    await flush();
    expect(t.show).toHaveBeenCalledTimes(2);

    t.set({ status: 'narrating', current: { ...a, landmark: landmark('B') } });
    await flush();
    expect(t.show).toHaveBeenCalledTimes(3);
    expect(t.show).toHaveBeenLastCalledWith(expect.objectContaining({ body: 'Now: B' }));

    t.set({ status: 'paused', current: a });
    await flush();
    expect(t.show).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'tour_paused' }));
  });

  it.each(['idle', 'ended'] as const)('dismisses when the tour goes to %s, once', async (status) => {
    const t = setup({ status: 'listening', current: null });
    t.start();
    t.set({ status, current: null });
    t.set({ status, current: null, headingDeg: 1 });
    await flush();
    expect(t.dismiss).toHaveBeenCalledTimes(1);
  });

  it('calls run in order: a late show never lands after a dismiss', async () => {
    const t = setup({ status: 'listening', current: null });
    const order: string[] = [];
    t.show.mockImplementation(async () => {
      await Promise.resolve();
      await Promise.resolve();
      order.push('show');
    });
    t.dismiss.mockImplementation(async () => {
      order.push('dismiss');
    });
    t.start();
    t.set({ status: 'idle', current: null });
    await flush();
    expect(order).toEqual(['show', 'dismiss']);
  });

  it('logs a failing show but never throws, and later updates still go through', async () => {
    const t = setup({ status: 'listening', current: null });
    t.show.mockRejectedValueOnce(new Error('no permission'));
    t.start();
    await flush();
    expect(t.log).toHaveBeenCalledWith('tour notification failed', expect.stringContaining('no permission'));
    t.set({ status: 'paused', current: null });
    await flush();
    expect(t.show).toHaveBeenCalledTimes(2);
  });

  it('logs a failing dismiss', async () => {
    const t = setup({ status: 'listening', current: null });
    t.dismiss.mockRejectedValueOnce(new Error('x'));
    t.start();
    t.set({ status: 'idle', current: null });
    await flush();
    expect(t.log).toHaveBeenCalledTimes(1);
  });

  it('the stop function unsubscribes and dismisses a shown notification', async () => {
    const t = setup({ status: 'listening', current: null });
    const stop = t.start();
    await flush();
    stop();
    await flush();
    expect(t.listenerCount()).toBe(0);
    expect(t.dismiss).toHaveBeenCalledTimes(1);
    t.set({ status: 'paused', current: null });
    await flush();
    expect(t.show).toHaveBeenCalledTimes(1);
  });

  it('the stop function does not dismiss when nothing was shown', async () => {
    const t = setup();
    t.start()();
    await flush();
    expect(t.dismiss).not.toHaveBeenCalled();
  });
});
