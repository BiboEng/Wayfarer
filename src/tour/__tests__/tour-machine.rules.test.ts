/**
 * Live Tour rules about what is picked: no repeats (tour and same day), silence when nothing
 * qualifies, quiet failures, stale answers, and driving.
 */
import { distanceMeters } from '@shared/geo/distance';

import { commandsOf, createHarness, NOON, TODAY } from '../__fixtures__/machine-harness';
import { offsetM, ORIGIN, place, placeWithoutWikipedia } from '../__fixtures__/places';
import { bearingDeg } from '../bearing';
import { tourReducer } from '../tour-machine';
import { localDateKey } from '../visited';

const A = place('A', offsetM(ORIGIN, 100));
const B = place('B', offsetM(ORIGIN, 150));
const MOVED = offsetM(ORIGIN, 70);

/** Nothing was asked for and nothing plays. */
function expectSilence(h: ReturnType<typeof createHarness>, from = 0) {
  const after = h.log.slice(from);
  expect(commandsOf(after, 'play')).toEqual([]);
  expect(commandsOf(after, 'fetchNarration')).toEqual([]);
  expect(commandsOf(after, 'prefetch')).toEqual([]);
  expect(h.state.current).toBeNull();
}

describe('no repeats within a tour', () => {
  it('a place that was narrated is not picked again when a new search returns it', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.ended();
    const before = h.log.length;
    h.fix(MOVED, 0);
    h.nearby([A]);
    expectSilence(h, before);
  });

  it('a place already narrated is skipped in favour of the next one', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A');
    h.deliver('B');
    h.ended();
    h.ended();
    expect(h.playedIds()).toEqual(['A', 'B']);
    h.fix(MOVED, 0);
    h.nearby([A, B]);
    expect(h.playedIds()).toEqual(['A', 'B']);
  });

  it('a long walk past the same places again plays each only once', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A');
    h.deliver('B');
    h.ended();
    h.ended();
    for (let i = 1; i <= 6; i++) {
      h.fix(offsetM(ORIGIN, 70 * i), 0);
      if (h.state.nearbyRequestId !== null) h.nearby([A, B]);
    }
    expect(h.playedIds()).toEqual(['A', 'B']);
  });
});

describe('no repeats across tours on the same day', () => {
  const heardEarlier = { date: TODAY, ids: ['A'] };

  it('a place on the visited list is never requested', () => {
    const h = createHarness();
    h.loadVisited(heardEarlier);
    h.fix(ORIGIN, 0);
    const cmds = h.nearby([A, B]);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['B']);
  });

  it('when only visited places are near, the tour is silent', () => {
    const h = createHarness();
    h.loadVisited({ date: TODAY, ids: ['A', 'B'] });
    h.fix(ORIGIN, 0);
    h.nearby([A, B]);
    expectSilence(h);
  });

  it('the list can arrive after the first search: nothing is picked until it is loaded', () => {
    const h = createHarness();
    h.fix(ORIGIN, 0);
    const found = h.nearby([A, B]);
    expect(commandsOf(found, 'fetchNarration')).toEqual([]);
    expect(h.state.current).toBeNull();

    const loaded = h.loadVisited(heardEarlier);
    expect(commandsOf(loaded, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['B']);
  });

  it('with nothing stored, a place is picked and saved for today', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    const day = commandsOf(h.deliver('A'), 'saveVisited')[0].day;
    expect(day).toEqual({ date: TODAY, ids: ['A'] });
  });

  it('keeps earlier ids when saving a new one', () => {
    const h = createHarness();
    h.loadVisited(heardEarlier);
    h.fix(ORIGIN, 0);
    h.nearby([B]);
    const day = commandsOf(h.deliver('B'), 'saveVisited')[0].day;
    expect(day.ids).toEqual(['A', 'B']);
  });

  it('a list from another day is ignored (reset)', () => {
    const h = createHarness();
    h.loadVisited({ date: '2026-06-09', ids: ['A'] });
    h.fix(ORIGIN, 0);
    const cmds = h.nearby([A]);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['A']);
  });
});

describe('the visited list resets when the date changes', () => {
  const at = (hour: number, minute: number, second: number, day = 10) => new Date(2026, 5, day, hour, minute, second).getTime();

  it('a place stays excluded until midnight and is allowed again right after', () => {
    expect(localDateKey(at(23, 59, 30))).toBe('2026-06-10');
    expect(localDateKey(at(0, 0, 30, 11))).toBe('2026-06-11');

    const h = createHarness();
    h.loadVisited({ date: '2026-06-10', ids: ['A'] }, '2026-06-10');
    h.fix(ORIGIN, 0, { now: at(23, 58, 0) });
    h.nearby([A]);
    expectSilence(h);

    // Before midnight, a new search still finds nothing.
    h.fix(offsetM(ORIGIN, 70), 0, { now: at(23, 59, 30) });
    h.nearby([A]);
    expectSilence(h);

    // After midnight the list is empty again, so A is a candidate.
    const cmds = h.fix(offsetM(ORIGIN, 140), 0, { now: at(0, 0, 30, 11) });
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['A']);
    expect(h.state.visited).toEqual({ date: '2026-06-11', ids: [] });
  });

  it('the new day is what gets saved afterwards', () => {
    const h = createHarness();
    h.loadVisited({ date: '2026-06-10', ids: ['X'] }, '2026-06-10');
    h.fix(ORIGIN, 0, { now: at(23, 59, 0) });
    h.nearby([]);
    h.fix(offsetM(ORIGIN, 70), 0, { now: at(0, 1, 0, 11) });
    h.nearby([A]);
    const day = commandsOf(h.deliver('A'), 'saveVisited')[0].day;
    expect(day).toEqual({ date: '2026-06-11', ids: ['A'] });
  });

  it('a place narrated earlier in this tour is not repeated after midnight', () => {
    const h = createHarness();
    h.loadVisited(null, '2026-06-10');
    h.fix(ORIGIN, 0, { now: at(23, 58, 0) });
    h.nearby([A]);
    h.deliver('A');
    h.ended();
    const before = h.log.length;
    h.fix(offsetM(ORIGIN, 70), 0, { now: at(0, 2, 0, 11) });
    h.nearby([A]);
    expectSilence(h, before);
  });

  it('does not reset within the same day', () => {
    const h = createHarness();
    h.loadVisited({ date: TODAY, ids: ['A'] });
    h.fix(ORIGIN, 0, { now: NOON });
    h.fix(offsetM(ORIGIN, 70), 0, { now: NOON + 6 * 3_600_000 });
    expect(h.state.visited?.ids).toEqual(['A']);
  });
});

describe('silence when nothing qualifies', () => {
  it('an empty search result', () => {
    const h = createHarness();
    h.begin([], ORIGIN, 0);
    expectSilence(h);
  });

  it('only places without a Wikipedia article', () => {
    const h = createHarness();
    h.begin([placeWithoutWikipedia('x', offsetM(ORIGIN, 50))], ORIGIN, 0);
    expectSilence(h);
  });

  it('only places outside the radius', () => {
    const h = createHarness();
    h.begin([place('far', offsetM(ORIGIN, 400))], ORIGIN, 0);
    expectSilence(h);
  });

  it('driving: only places behind', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([place('behind', offsetM(ORIGIN, -300))], ORIGIN, 0);
    expectSilence(h);
  });

  it('stays silent through many fixes with nothing near', () => {
    const h = createHarness();
    h.loadVisited();
    for (let i = 0; i < 10; i++) {
      h.fix(offsetM(ORIGIN, 70 * i), 0);
      if (h.state.nearbyRequestId !== null) h.nearby([]);
    }
    expectSilence(h);
    expect(commandsOf(h.log, 'saveVisited')).toEqual([]);
  });

  it('no heading: a place behind is still possible when walking (nothing is dropped as behind)', () => {
    const h = createHarness();
    h.begin([place('x', offsetM(ORIGIN, -100))], ORIGIN, null);
    expect(h.state.current).toMatchObject({ phase: 'fetching' });
  });
});

describe('quiet failures', () => {
  it('a failed search is skipped without error and retried at the next check', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    const requestId = h.state.nearbyRequestId ?? -1;
    expect(() => h.send({ type: 'NEARBY_FAILED', requestId })).not.toThrow();
    expectSilence(h);
    expect(h.state.nearbyRequestId).toBeNull();

    // Not moved far enough for a check yet: no search.
    expect(commandsOf(h.fix(offsetM(ORIGIN, 10), 0), 'fetchNearby')).toEqual([]);
    // The next check searches again.
    const retry = commandsOf(h.fix(MOVED, 0), 'fetchNearby');
    expect(retry).toHaveLength(1);
    expect(retry[0].requestId).toBeGreaterThan(requestId);
    expect(commandsOf(h.nearby([A]), 'fetchNarration').map((c) => c.landmarkId)).toEqual(['A']);
  });

  it('a failed search keeps the previous results', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.fix(MOVED, 0);
    h.send({ type: 'NEARBY_FAILED', requestId: h.state.nearbyRequestId ?? -1 });
    expect(h.state.nearby).toEqual([A]);
  });

  it('a failed story request is skipped without error: no play, the queue is not blocked for long', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    expect(() => h.failRequest('A')).not.toThrow();
    expect(h.state.current).toBeNull();
    expect(h.playedIds()).toEqual([]);
    expect(h.state.failedIds).toEqual(['A']);
  });

  it('after a failed story request nothing new is requested until the next check', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.failRequest('A');
    const before = h.log.length;
    h.fix(offsetM(ORIGIN, 10), 0);
    h.fix(offsetM(ORIGIN, 20), 0);
    expectSilence(h, before);
  });

  it('the next check retries the failed place', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.failRequest('A');
    const cmds = h.fix(MOVED, 0);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['A']);
    expect(h.state.failedIds).toEqual([]);
    const played = h.deliver('A');
    expect(commandsOf(played, 'play')).toHaveLength(1);
  });

  it('a failed request is not marked visited', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.failRequest('A');
    expect(h.state.visited?.ids).toEqual([]);
    expect(h.state.history).toEqual([]);
    expect(commandsOf(h.log, 'saveVisited')).toEqual([]);
  });

  it('a failed replay request does not block the queue or change the history', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.ended();
    // Force a replay through the fetch path (the story is not known).
    const forced = { ...h.state, stories: {} };
    const replayed = tourReducer(forced, { type: 'REPLAY', landmarkId: 'A' });
    const fetch = commandsOf(replayed.commands, 'fetchNarration')[0];
    expect(fetch).toBeDefined();
    const failed = tourReducer(replayed.state, { type: 'NARRATION_FAILED', requestId: fetch.requestId });
    expect(failed.state.current).toBeNull();
    expect(failed.state.history).toHaveLength(1);
    expect(failed.state.holdUntilCheck).toBe(false);
  });
});

describe('stale answers are ignored', () => {
  it('a search result with an old request id changes nothing', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    const oldId = h.state.nearbyRequestId ?? -1;
    h.fix(MOVED, 0); // a newer search
    const cmds = h.send({ type: 'NEARBY_RESULT', requestId: oldId, landmarks: [A] });
    expect(cmds).toEqual([]);
    expect(h.state.nearby).toEqual([]);
    expect(h.state.nearbyRequestId).not.toBeNull();

    const fresh = h.nearby([B]);
    expect(commandsOf(fresh, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['B']);
  });

  it('a search failure with an old request id does not cancel the newer search', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    const oldId = h.state.nearbyRequestId ?? -1;
    h.fix(MOVED, 0);
    const newId = h.state.nearbyRequestId;
    h.send({ type: 'NEARBY_FAILED', requestId: oldId });
    expect(h.state.nearbyRequestId).toBe(newId);
  });

  it('a story answer with an unknown request id never starts playing', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    const cmds = h.send({ type: 'NARRATION_READY', requestId: 999, narration: { landmarkId: 'A', text: 't', audio: null, source: 'ai' } });
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.state.current).toMatchObject({ phase: 'fetching' });
  });

  it('a story failure with an unknown request id changes nothing', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    const before = h.state;
    h.send({ type: 'NARRATION_FAILED', requestId: 999 });
    expect(h.state).toBe(before);
  });

  it('a story answer for the wrong request id cannot start another story', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0); // A requested (id 2)
    h.send({ type: 'NARRATION_READY', requestId: 3, narration: { landmarkId: 'B', text: 't', audio: null, source: 'ai' } });
    expect(h.playedIds()).toEqual([]);
  });
});

describe('driving', () => {
  const far = (id: string, north: number) => place(id, offsetM(ORIGIN, north));

  it('uses the driving search radius (800 m)', () => {
    const h = createHarness({ mode: 'driving' });
    h.loadVisited();
    const cmds = h.fix(ORIGIN, 0);
    expect(commandsOf(cmds, 'fetchNearby')[0].radiusM).toBe(800);
  });

  it('a story arriving after its place is behind is dropped, and the next one is picked', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([far('passed', 500), far('next', 780)], ORIGIN, 0);
    expect(h.state.current).toMatchObject({ landmark: { id: 'passed' } });

    h.fix(offsetM(ORIGIN, 700), 0); // drove past it while the story was being made
    const cmds = h.deliver('passed');

    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['next']);
    expect(h.state.history).toEqual([]);
    expect(h.state.visited?.ids).toEqual([]);
    expect(commandsOf(h.log, 'saveVisited')).toEqual([]);
  });

  it('a story arriving when its place is more than 1.5x the radius away is dropped', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([far('p', 790)], ORIGIN, 0);
    h.fix(offsetM(ORIGIN, -450), 0); // 1240 m from the place, which is still ahead
    const cmds = h.deliver('p');
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.state.current).toBeNull();
  });

  it('a story whose place is still ahead and in range plays', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([far('p', 600)], ORIGIN, 0);
    h.fix(offsetM(ORIGIN, 300), 0);
    expect(commandsOf(h.deliver('p'), 'play')).toHaveLength(1);
  });

  it('a story held while paused is dropped on resume if its place is behind by then', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([far('p', 500)], ORIGIN, 0);
    h.send({ type: 'PAUSE' });
    h.deliver('p');
    expect(h.state.current).toMatchObject({ phase: 'ready' });
    h.fix(offsetM(ORIGIN, 700), 0);
    const cmds = h.send({ type: 'RESUME' });
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.state.current).toBeNull();
  });

  it('a pre-fetched story whose place is behind by the time it is needed is not played', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([far('a', 300), far('b', 400)], ORIGIN, 0);
    h.deliver('a');
    h.deliver('b'); // pre-fetched
    h.fix(offsetM(ORIGIN, 600), 0); // both behind now
    h.nearby([far('a', 300), far('b', 400)]);
    const cmds = h.ended();
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.playedIds()).toEqual(['a']);
  });

  it('walking stories are never dropped for distance or direction', () => {
    const h = createHarness();
    h.begin([place('p', offsetM(ORIGIN, 150))], ORIGIN, 0);
    h.fix(offsetM(ORIGIN, -100), 0); // now 250 m away (> radius)
    expect(commandsOf(h.deliver('p'), 'play')).toHaveLength(1);
  });

  it('driving picks only places ahead or to the side', () => {
    const h = createHarness({ mode: 'driving' });
    const cmds = h.begin([far('behind', -200), far('ahead', 500)], ORIGIN, 0);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['ahead']);
  });
});

describe('travel mode changes', () => {
  it('switching mode searches again at once with the new radius', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    const walkingSearch = commandsOf(h.log, 'fetchNearby')[0];
    expect(walkingSearch.radiusM).toBe(200);

    const cmds = h.fix(offsetM(ORIGIN, 5), 0, { mode: 'driving' }); // barely moved
    const search = commandsOf(cmds, 'fetchNearby');
    expect(search).toHaveLength(1);
    expect(search[0].radiusM).toBe(800);
    expect(h.state.mode).toBe('driving');
  });

  it('the answer to the old (walking) search is ignored after the switch', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    const walkingId = h.state.nearbyRequestId ?? -1;
    h.fix(offsetM(ORIGIN, 5), 0, { mode: 'driving' });
    const cmds = h.send({ type: 'NEARBY_RESULT', requestId: walkingId, landmarks: [A] });
    expect(cmds).toEqual([]);
  });

  it('staying in the same mode does not search again', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    expect(commandsOf(h.fix(offsetM(ORIGIN, 5), 0), 'fetchNearby')).toEqual([]);
  });
});

describe('retrying while standing still', () => {
  const minute = 60_000;

  it('a failed search is searched again after about a minute without moving', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    h.send({ type: 'NEARBY_FAILED', requestId: h.state.nearbyRequestId ?? -1 });
    expect(commandsOf(h.fix(ORIGIN, 0, { now: NOON + 20_000 }), 'fetchNearby')).toEqual([]);
    expect(commandsOf(h.fix(ORIGIN, 0, { now: NOON + minute + 1000 }), 'fetchNearby')).toHaveLength(1);
  });

  it('a failed story request is retried after about a minute without moving', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.failRequest('A');
    expect(commandsOf(h.fix(ORIGIN, 0, { now: NOON + 20_000 }), 'fetchNarration')).toEqual([]);
    const later = h.fix(ORIGIN, 0, { now: NOON + minute + 1000 });
    expect(commandsOf(later, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['A']);
  });

  it('an empty but successful search is not repeated while standing still (distance only)', () => {
    const h = createHarness();
    h.begin([], ORIGIN, 0);
    for (let i = 1; i <= 10; i++) {
      expect(commandsOf(h.fix(ORIGIN, 0, { now: NOON + i * 5 * minute }), 'fetchNearby')).toEqual([]);
    }
  });

  it('the retry is spent once: it does not search again at every fix', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    h.send({ type: 'NEARBY_FAILED', requestId: h.state.nearbyRequestId ?? -1 });
    h.fix(ORIGIN, 0, { now: NOON + minute + 1000 });
    h.nearby([]);
    expect(commandsOf(h.fix(ORIGIN, 0, { now: NOON + minute + 4000 }), 'fetchNearby')).toEqual([]);
  });
});

describe('driving search is centred ahead', () => {
  it('with a heading, the search centre is about 400 m ahead of the car', () => {
    const h = createHarness({ mode: 'driving' });
    h.loadVisited();
    const [search] = commandsOf(h.fix(ORIGIN, 90), 'fetchNearby');
    expect(distanceMeters(ORIGIN, search.center)).toBeCloseTo(400, -1);
    expect(bearingDeg(ORIGIN, search.center)).toBeCloseTo(90, 0);
    expect(search.radiusM).toBe(800);
  });

  it('without a heading the search is centred on the car', () => {
    const h = createHarness({ mode: 'driving' });
    h.loadVisited();
    expect(commandsOf(h.fix(ORIGIN, null), 'fetchNearby')[0].center).toEqual(ORIGIN);
  });

  it('walking is always centred on the walker', () => {
    const h = createHarness();
    h.loadVisited();
    expect(commandsOf(h.fix(ORIGIN, 0), 'fetchNearby')[0].center).toEqual(ORIGIN);
  });

  it('ranking still uses the real position: a place 700 m ahead is a candidate, one 700 m behind is not', () => {
    const h = createHarness({ mode: 'driving' });
    const cmds = h.begin([place('ahead', offsetM(ORIGIN, 700)), place('behind', offsetM(ORIGIN, -300))], ORIGIN, 0);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['ahead']);
  });
});
