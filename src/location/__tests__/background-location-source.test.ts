/**
 * The background source over a fake expo-location: the location task is shared by every tour, so
 * a late answer from an old tour must never stop a newer tour's updates.
 */
import type { TrackingOptions } from '../types';

interface Deferred {
  resolve(): void;
  reject(err: Error): void;
}

const pendingStarts: Deferred[] = [];
const mockStart = jest.fn(
  () =>
    new Promise<void>((resolve, reject) => {
      pendingStarts.push({ resolve, reject });
    }),
);
const mockStop = jest.fn(() => Promise.resolve());

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  startLocationUpdatesAsync: (...args: unknown[]) => mockStart(...(args as [])),
  stopLocationUpdatesAsync: (...args: unknown[]) => mockStop(...(args as [])),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));

// eslint-disable-next-line import/first -- the mocks above must be set up first
import { createBackgroundLocationSource } from '../background-location-source';

const OPTIONS: TrackingOptions = { accuracy: 'high', distanceIntervalM: 0, timeIntervalMs: 3_000 };
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  pendingStarts.length = 0;
  mockStart.mockClear();
  mockStop.mockClear();
});

describe('background location source', () => {
  it('stops a start that resolves after its own stop', async () => {
    const source = createBackgroundLocationSource();
    const started = source.start(OPTIONS, jest.fn());
    source.stop();
    expect(mockStop).toHaveBeenCalledTimes(1);
    pendingStarts[0].resolve();
    await started;
    expect(mockStop).toHaveBeenCalledTimes(2);
  });

  it("never lets an old tour's late start stop a newer tour", async () => {
    const tourA = createBackgroundLocationSource();
    const startedA = tourA.start(OPTIONS, jest.fn());
    tourA.stop();
    const tourB = createBackgroundLocationSource();
    const startedB = tourB.start(OPTIONS, jest.fn());
    pendingStarts[1].resolve();
    await startedB;
    mockStop.mockClear();

    pendingStarts[0].resolve();
    await startedA;
    expect(mockStop).not.toHaveBeenCalled();
  });

  it("never lets an old tour's stop or refusal stop a newer tour", async () => {
    const tourA = createBackgroundLocationSource();
    const startedA = tourA.start(OPTIONS, jest.fn());
    const tourB = createBackgroundLocationSource();
    const startedB = tourB.start(OPTIONS, jest.fn());
    pendingStarts[1].resolve();
    await startedB;

    tourA.stop();
    pendingStarts[0].reject(new Error('refused'));
    await expect(startedA).rejects.toThrow('refused');
    await flush();
    expect(mockStop).not.toHaveBeenCalled();

    tourB.stop();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('ignores setOptions once a newer tour holds the task', async () => {
    const tourA = createBackgroundLocationSource();
    const startedA = tourA.start(OPTIONS, jest.fn());
    pendingStarts[0].resolve();
    await startedA;
    const tourB = createBackgroundLocationSource();
    void tourB.start(OPTIONS, jest.fn());
    mockStart.mockClear();

    await tourA.setOptions({ ...OPTIONS, timeIntervalMs: 5_000 });
    expect(mockStart).not.toHaveBeenCalled();
  });
});
