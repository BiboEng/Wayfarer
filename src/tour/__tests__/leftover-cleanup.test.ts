import { cleanUpLeftovers, type LeftoverDeps } from '../leftover-cleanup';

function setup(over: Partial<LeftoverDeps> = {}) {
  const deps = {
    isTourRunning: jest.fn(() => false),
    hasStartedUpdates: jest.fn(async () => true),
    stopUpdates: jest.fn(async () => undefined),
    dismissNotification: jest.fn(async () => undefined),
    ...over,
  } satisfies LeftoverDeps;
  return deps;
}

describe('cleanUpLeftovers', () => {
  it('dismisses the notification and stops surviving updates', async () => {
    const deps = setup();
    await cleanUpLeftovers(deps);
    expect(deps.dismissNotification).toHaveBeenCalledTimes(1);
    expect(deps.stopUpdates).toHaveBeenCalledTimes(1);
  });

  it('does not stop updates that are not running', async () => {
    const deps = setup({ hasStartedUpdates: jest.fn(async () => false) });
    await cleanUpLeftovers(deps);
    expect(deps.stopUpdates).not.toHaveBeenCalled();
  });

  it('touches nothing while a tour is running', async () => {
    const deps = setup({ isTourRunning: jest.fn(() => true) });
    await cleanUpLeftovers(deps);
    expect(deps.dismissNotification).not.toHaveBeenCalled();
    expect(deps.hasStartedUpdates).not.toHaveBeenCalled();
    expect(deps.stopUpdates).not.toHaveBeenCalled();
  });

  it('leaves updates alone if a tour started while it was asking', async () => {
    let running = false;
    const deps = setup({
      isTourRunning: jest.fn(() => running),
      hasStartedUpdates: jest.fn(async () => {
        running = true;
        return true;
      }),
    });
    await cleanUpLeftovers(deps);
    expect(deps.stopUpdates).not.toHaveBeenCalled();
  });

  it('never rejects when a step fails', async () => {
    await expect(cleanUpLeftovers(setup({ dismissNotification: jest.fn(async () => Promise.reject(new Error('x'))) }))).resolves.toBeUndefined();
    await expect(cleanUpLeftovers(setup({ stopUpdates: jest.fn(async () => Promise.reject(new Error('x'))) }))).resolves.toBeUndefined();
  });
});
