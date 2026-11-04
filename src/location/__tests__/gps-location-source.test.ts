import { createGpsLocationSource } from '../gps-location-source';
import { createFakeBackground, createFakeWatch, deferred, DRIVE, fix, flush, WALK } from '../__fixtures__/fakes';

function setup() {
  const bg = createFakeBackground();
  const watch = createFakeWatch();
  const foreground: ReturnType<typeof deferred>[] = [];
  const known: boolean[] = [];
  const createWatch = jest.fn(() => watch.source);
  const whenForeground = jest.fn(() => {
    const d = deferred();
    foreground.push(d);
    return d.promise;
  });
  const source = createGpsLocationSource({
    background: bg.source,
    createWatch,
    whenForeground,
    onBackgroundKnown: (runs) => known.push(runs),
  });
  const fixes: number[] = [];
  const errors: string[] = [];
  const begin = (options = WALK) =>
    source.start(
      options,
      (f) => fixes.push(f.lat),
      (m) => errors.push(m),
    );
  return { bg, watch, foreground, known, createWatch, source, fixes, errors, begin };
}

describe('createGpsLocationSource', () => {
  it('starts the background task first, with distance 0, and reports it', async () => {
    const t = setup();
    t.begin();
    expect(t.bg.source.start).toHaveBeenCalledWith({ ...WALK, distanceIntervalM: 0 }, expect.any(Function), expect.any(Function));
    expect(t.known).toEqual([]);
    t.bg.starts[0].resolve();
    await flush();
    expect(t.known).toEqual([true]);
    expect(t.createWatch).not.toHaveBeenCalled();
  });

  it('forwards background fixes to the tour', async () => {
    const t = setup();
    t.begin();
    t.bg.starts[0].resolve();
    await flush();
    t.bg.emit(fix(1));
    t.bg.emit(fix(2));
    expect(t.fixes).toEqual([1, 2]);
  });

  it('retries once when the app is back on screen, then runs in the background', async () => {
    const t = setup();
    t.begin();
    t.bg.starts[0].reject(new Error('refused'));
    await flush();
    expect(t.errors[0]).toContain('refused');
    expect(t.bg.source.start).toHaveBeenCalledTimes(1);
    t.foreground[0].resolve();
    await flush();
    expect(t.bg.source.start).toHaveBeenCalledTimes(2);
    t.bg.starts[1].resolve();
    await flush();
    expect(t.known).toEqual([true]);
    expect(t.createWatch).not.toHaveBeenCalled();
  });

  it('falls back to the watch when the retry is refused too, reporting false once', async () => {
    const t = setup();
    t.begin(DRIVE);
    t.bg.starts[0].reject(new Error('no'));
    await flush();
    t.foreground[0].resolve();
    await flush();
    t.bg.starts[1].reject(new Error('still no'));
    await flush();
    expect(t.createWatch).toHaveBeenCalledTimes(1);
    expect(t.watch.source.start).toHaveBeenCalledWith(DRIVE, expect.any(Function), expect.any(Function));
    expect(t.known).toEqual([false]);
    t.watch.emit(fix(7));
    expect(t.fixes).toEqual([7]);
  });

  it('retry uses the options wanted at that time', async () => {
    const t = setup();
    t.begin(WALK);
    t.bg.starts[0].reject(new Error('no'));
    await flush();
    t.source.setOptions(DRIVE);
    t.foreground[0].resolve();
    await flush();
    expect(t.bg.source.start).toHaveBeenLastCalledWith({ ...DRIVE, distanceIntervalM: 0 }, expect.any(Function), expect.any(Function));
  });

  it('a stop while waiting for the screen starts nothing more', async () => {
    const t = setup();
    t.begin();
    t.bg.starts[0].reject(new Error('no'));
    await flush();
    t.source.stop();
    t.foreground[0].resolve();
    await flush();
    expect(t.bg.source.start).toHaveBeenCalledTimes(1);
    expect(t.createWatch).not.toHaveBeenCalled();
    expect(t.known).toEqual([]);
  });

  it('a mode change while starting is applied once the task runs', async () => {
    const t = setup();
    t.begin(WALK);
    t.source.setOptions(DRIVE);
    expect(t.bg.source.setOptions).not.toHaveBeenCalled();
    t.bg.starts[0].resolve();
    await flush();
    expect(t.bg.source.setOptions).toHaveBeenCalledWith({ ...DRIVE, distanceIntervalM: 0 });
  });

  it('applies option changes to the running task; skips an unchanged object', async () => {
    const t = setup();
    t.begin(WALK);
    t.bg.starts[0].resolve();
    await flush();
    t.source.setOptions(WALK);
    expect(t.bg.source.setOptions).not.toHaveBeenCalled();
    t.source.setOptions(DRIVE);
    expect(t.bg.source.setOptions).toHaveBeenCalledTimes(1);
  });

  it('defers a refused option change to the next time on screen, once', async () => {
    const t = setup();
    t.begin(WALK);
    t.bg.starts[0].resolve();
    await flush();
    t.source.setOptions(DRIVE);
    t.bg.setOptionsCalls[0].reject(new Error('off screen'));
    await flush();
    expect(t.errors.some((e) => e.includes('off screen'))).toBe(true);
    expect(t.bg.source.setOptions).toHaveBeenCalledTimes(1);
    t.foreground[0].resolve();
    await flush();
    expect(t.bg.source.setOptions).toHaveBeenCalledTimes(2);
    t.bg.setOptionsCalls[1].reject(new Error('again'));
    await flush();
    expect(t.foreground).toHaveLength(1); // no second retry
    expect(t.bg.source.setOptions).toHaveBeenCalledTimes(2);
  });

  it('skips the deferred option change if newer options were wanted meanwhile', async () => {
    const t = setup();
    t.begin(WALK);
    t.bg.starts[0].resolve();
    await flush();
    t.source.setOptions(DRIVE);
    t.bg.setOptionsCalls[0].reject(new Error('off'));
    await flush();
    t.source.setOptions({ ...WALK });
    expect(t.bg.source.setOptions).toHaveBeenCalledTimes(2); // the newer one goes out now
    t.foreground[0].resolve();
    await flush();
    expect(t.bg.source.setOptions).toHaveBeenCalledTimes(2); // the stale retry is skipped
  });

  it('forwards option changes to the watch after a fall back', async () => {
    const t = setup();
    t.begin(WALK);
    t.bg.starts[0].reject(new Error('x'));
    await flush();
    t.foreground[0].resolve();
    await flush();
    t.bg.starts[1].reject(new Error('x'));
    await flush();
    t.source.setOptions(DRIVE);
    expect(t.watch.source.setOptions).toHaveBeenCalledWith(DRIVE);
  });

  it('stop stops the background task; later fixes are dropped', async () => {
    const t = setup();
    t.begin();
    t.bg.starts[0].resolve();
    await flush();
    t.source.stop();
    expect(t.bg.source.stop).toHaveBeenCalledTimes(1);
    t.bg.emit(fix(9));
    expect(t.fixes).toEqual([]);
  });

  it('stop stops the watch after a fall back', async () => {
    const t = setup();
    t.begin();
    t.bg.starts[0].reject(new Error('x'));
    await flush();
    t.foreground[0].resolve();
    await flush();
    t.bg.starts[1].reject(new Error('x'));
    await flush();
    t.source.stop();
    expect(t.watch.source.stop).toHaveBeenCalledTimes(1);
  });

  it('stop does nothing to the background task when it was never started', () => {
    const t = setup();
    t.source.stop();
    expect(t.bg.source.stop).not.toHaveBeenCalled();
  });

  it('a late start answer from a stopped run is ignored', async () => {
    const t = setup();
    t.begin();
    t.source.stop();
    t.bg.starts[0].resolve();
    await flush();
    expect(t.known).toEqual([]);
  });

  it('setOptions when off is a no-op', () => {
    const t = setup();
    t.source.setOptions(DRIVE);
    expect(t.bg.source.setOptions).not.toHaveBeenCalled();
  });
});
