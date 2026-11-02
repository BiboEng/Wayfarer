/**
 * Live Tour rules about the queue: one story at a time (no overlap), never cut off,
 * pre-fetch, pause, skip and replay.
 */
import { commandsOf, createHarness, NOON } from '../__fixtures__/machine-harness';
import { narrationFor, offsetM, ORIGIN, place } from '../__fixtures__/places';

const A = place('A', offsetM(ORIGIN, 100));
const B = place('B', offsetM(ORIGIN, 190));
/** Where the walker is after a move long enough (70 m) to trigger a new search. */
const MOVED = offsetM(ORIGIN, 70);
const types = (commands: { type: string }[]) => commands.map((c) => c.type);

/** A tour where A is playing and B has been pre-fetched (request sent, not delivered). */
function playingAWithBPrefetching() {
  const h = createHarness();
  h.begin([A, B], ORIGIN, 0);
  h.deliver('A');
  return h;
}

describe('starting a story', () => {
  it('searches on the first fix, then asks for the best place, then plays it', () => {
    const h = createHarness();
    h.loadVisited();
    const first = h.fix(ORIGIN, 0);
    expect(commandsOf(first, 'fetchNearby')).toEqual([{ type: 'fetchNearby', requestId: 1, center: ORIGIN, radiusM: 200 }]);

    const afterSearch = h.nearby([B, A]);
    expect(commandsOf(afterSearch, 'fetchNarration')).toEqual([
      { type: 'fetchNarration', requestId: 2, landmarkId: 'A', travelMode: 'walking' },
    ]);
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'A' } });

    const afterStory = h.deliver('A');
    expect(types(afterStory)).toEqual(['play', 'saveVisited', 'prefetch']);
    expect(commandsOf(afterStory, 'play')[0]).toMatchObject({ narrationId: 'tour:1:A', landmark: A, side: 'ahead' });
    expect(h.state.current).toMatchObject({ phase: 'playing' });
    expect(h.violations).toEqual([]);
  });

  it('marks the place visited for today and adds it to the history', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    const cmds = h.deliver('A');
    expect(commandsOf(cmds, 'saveVisited')[0].day.ids).toEqual(['A']);
    expect(h.state.history.map((item) => item.landmark.id)).toEqual(['A']);
    expect(h.state.history[0].narratedAt).toBeGreaterThan(0);
  });

  it('asks for the story with the travel mode of the moment', () => {
    const h = createHarness({ mode: 'driving' });
    const cmds = h.begin([place('far', offsetM(ORIGIN, 500))], ORIGIN, 0);
    expect(commandsOf(cmds, 'fetchNarration')[0].travelMode).toBe('driving');
  });

  it.each([
    ['ahead', offsetM(ORIGIN, 100), 0, 'ahead'],
    ['left', offsetM(ORIGIN, 0, -100), 0, 'left'],
    ['right', offsetM(ORIGIN, 0, 100), 0, 'right'],
    ['behind (no line)', offsetM(ORIGIN, -100), 0, null],
    ['too close (no line)', offsetM(ORIGIN, 30), 0, null],
    ['no heading (no line)', offsetM(ORIGIN, 100), null, null],
  ] as const)('the orientation line for a place %s', (_name, at, heading, side) => {
    const h = createHarness();
    h.begin([place('P', at)], ORIGIN, heading);
    const play = commandsOf(h.deliver('P'), 'play')[0];
    expect(play.side).toBe(side);
    expect(h.state.current).toMatchObject({ side });
  });
});

describe('no overlap', () => {
  it('a second candidate arriving mid-story waits: no play, no request', () => {
    const h = playingAWithBPrefetching();
    const C = place('C', offsetM(ORIGIN, 160));
    const moved = h.fix(MOVED, 0);
    const found = h.nearby([A, B, C]);

    for (const cmds of [moved, found]) {
      expect(commandsOf(cmds, 'play')).toEqual([]);
      expect(commandsOf(cmds, 'fetchNarration')).toEqual([]);
    }
    expect(h.playingId()).toBe('A');
    expect(h.playedIds()).toEqual(['A']);
    expect(h.violations).toEqual([]);
  });

  it('a pre-fetched story arriving mid-story does not start playing', () => {
    const h = playingAWithBPrefetching();
    const cmds = h.deliver('B');
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.playingId()).toBe('A');
  });

  it('a pre-fetch adopted at the end of a story plays only once it arrives', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A'); // A playing, B pre-fetching
    h.fix(MOVED, 0);
    h.nearby([A, B]);
    h.ended(); // B is adopted from the pre-fetch (fetching)
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'B' } });
    expect(commandsOf(h.log, 'play')).toHaveLength(1);
    h.deliver('B');
    expect(h.playedIds()).toEqual(['A', 'B']);
    expect(h.violations).toEqual([]);
  });

  it('many fixes and searches while a story plays never produce a second play', () => {
    const h = playingAWithBPrefetching();
    for (let i = 1; i <= 10; i++) {
      h.fix(offsetM(ORIGIN, 70 * i), 0);
      if (h.state.nearbyRequestId !== null) h.nearby([A, B, place(`X${i}`, offsetM(ORIGIN, 70 * i + 50))]);
    }
    expect(h.playedIds()).toEqual(['A']);
    expect(h.violations).toEqual([]);
  });

  it('only one story is ever being fetched for playback at a time', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    const requests = commandsOf(h.log, 'fetchNarration');
    expect(requests).toHaveLength(1);
    // More searches while A is still being fetched: no second request.
    h.fix(MOVED, 0);
    h.nearby([A, B]);
    expect(commandsOf(h.log, 'fetchNarration')).toHaveLength(1);
    expect(commandsOf(h.log, 'prefetch')).toHaveLength(0);
  });
});

describe('no cut-off', () => {
  it('the next story starts only after the current one ends', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    expect(h.playedIds()).toEqual(['A']);
    const cmds = h.ended();
    expect(commandsOf(cmds, 'play').map((c) => c.landmark.id)).toEqual(['B']);
    expect(h.playedIds()).toEqual(['A', 'B']);
  });

  it('a stopPlayback command is only ever issued for a user action or Stop', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    h.fix(MOVED, 0);
    h.nearby([A, B, place('C', offsetM(ORIGIN, 160))]);
    h.ended(); // C is now the better pick and is requested
    h.deliver('C');
    h.ended(); // B's story was kept
    h.ended();
    expect(h.playedIds()).toEqual(['A', 'C', 'B']);
    expect(commandsOf(h.log, 'stopPlayback')).toEqual([]);
    expect(h.violations).toEqual([]);
  });

  it('an ended report for another narration id does not release the current story', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    const cmds = h.send({ type: 'PLAYBACK_ENDED', narrationId: 'tour:99:other' });
    expect(cmds).toEqual([]);
    expect(h.playingId()).toBe('A');
  });

  it('an ended report when nothing is playing is ignored', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0); // still fetching
    expect(h.send({ type: 'PLAYBACK_ENDED', narrationId: 'tour:1:A' })).toEqual([]);
    expect(h.state.current).toMatchObject({ phase: 'fetching' });
  });

  it('a playback that failed is reported as ended and the queue moves on', () => {
    // The player link turns "failed" into an ended report; the machine treats it like any end.
    const h = playingAWithBPrefetching();
    h.deliver('B');
    h.ended();
    expect(h.playingId()).toBe('B');
  });

  it('after the last story ends the tour goes quiet', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    const cmds = h.ended();
    expect(cmds).toEqual([]);
    expect(h.state.current).toBeNull();
  });
});

describe('pre-fetch', () => {
  it('starts one pre-fetch for the next best place while a story plays', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    const cmds = h.deliver('A');
    expect(commandsOf(cmds, 'prefetch')).toEqual([{ type: 'prefetch', requestId: 3, landmarkId: 'B', travelMode: 'walking' }]);
  });

  it('never starts a second pre-fetch while one is on its way or ready', () => {
    const h = createHarness();
    const C = place('C', offsetM(ORIGIN, 160));
    h.begin([A, B, C], ORIGIN, 0);
    h.deliver('A');
    expect(commandsOf(h.log, 'prefetch')).toHaveLength(1);
    h.fix(MOVED, 0);
    h.nearby([A, B, C]);
    h.fix(offsetM(ORIGIN, 140), 0);
    h.nearby([A, B, C]);
    expect(commandsOf(h.log, 'prefetch')).toHaveLength(1);
    h.deliver('C'); // whichever it was for
    expect(commandsOf(h.log, 'prefetch')).toHaveLength(1);
  });

  it('does not pre-fetch when nothing else qualifies', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    expect(commandsOf(h.deliver('A'), 'prefetch')).toEqual([]);
  });

  it('uses the pre-fetched story when it is still the top pick: no new request', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    const requestsBefore = commandsOf(h.log, 'fetchNarration').length;
    const cmds = h.ended();
    expect(commandsOf(cmds, 'fetchNarration')).toEqual([]);
    expect(commandsOf(cmds, 'prefetch')).toEqual([]);
    expect(commandsOf(h.log, 'fetchNarration')).toHaveLength(requestsBefore);
    expect(commandsOf(cmds, 'play')[0]).toMatchObject({ landmark: B });
  });

  it('waits for a pre-fetch still in flight instead of requesting again', () => {
    const h = playingAWithBPrefetching();
    const prefetchId = h.requestIdFor('B');
    const cmds = h.ended();
    expect(cmds).toEqual([]);
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'B' }, requestId: prefetchId });
    expect(commandsOf(h.log, 'fetchNarration')).toHaveLength(1); // only A's
    const delivered = h.deliver('B');
    expect(commandsOf(delivered, 'play')[0]).toMatchObject({ landmark: B });
  });

  it('when the top pick changed, requests the new one and ignores the old pre-fetch', () => {
    const h = playingAWithBPrefetching(); // B pre-fetching
    const C = place('C', offsetM(ORIGIN, 160)); // closer to the walker at MOVED than B
    h.fix(MOVED, 0);
    h.nearby([A, B, C]);
    const cmds = h.ended();
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['C']);
    expect(h.state.prefetch).toBeNull();

    // B's late answer is kept for later but does not play over C's turn.
    const lateB = h.deliver('B');
    expect(commandsOf(lateB, 'play')).toEqual([]);
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'C' } });

    h.deliver('C');
    const afterC = h.ended();
    // B's story is already there: no further request.
    expect(commandsOf(afterC, 'fetchNarration')).toEqual([]);
    expect(commandsOf(afterC, 'play')[0]).toMatchObject({ landmark: B });
    expect(h.violations).toEqual([]);
  });

  it('a failed pre-fetch excludes that place only until the next check', () => {
    const h = playingAWithBPrefetching();
    h.failRequest('B');
    expect(h.state.prefetch).toBeNull();
    expect(h.state.failedIds).toEqual(['B']);

    // Still before the next check: no new pre-fetch for B, and nothing happens when A ends.
    const sameCheck = h.fix(offsetM(ORIGIN, 10), 0);
    expect(commandsOf(sameCheck, 'prefetch')).toEqual([]);
    const afterEnd = h.ended();
    expect(commandsOf(afterEnd, 'fetchNarration')).toEqual([]);
    expect(commandsOf(afterEnd, 'play')).toEqual([]);

    // The next check clears the exclusion and B is tried again.
    const nextCheck = h.fix(offsetM(ORIGIN, 80), 0);
    expect(commandsOf(nextCheck, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['B']);
  });

  it('a failed pre-fetch does not throw or stop the current story', () => {
    const h = playingAWithBPrefetching();
    expect(() => h.failRequest('B')).not.toThrow();
    expect(h.playingId()).toBe('A');
  });
});

describe('pause', () => {
  it('pauses the playing story and holds the queue', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    const paused = h.send({ type: 'PAUSE' });
    expect(types(paused)).toEqual(['pausePlayback']);
    expect(h.state.paused).toBe(true);

    // Even if the story ends (or the system ended it) while paused, nothing new starts.
    const ended = h.ended();
    expect(commandsOf(ended, 'play')).toEqual([]);
    expect(commandsOf(ended, 'fetchNarration')).toEqual([]);
    expect(h.state.current).toBeNull();
  });

  it('resume releases the held queue', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    h.send({ type: 'PAUSE' });
    h.ended();
    const resumed = h.send({ type: 'RESUME' });
    expect(commandsOf(resumed, 'play')[0]).toMatchObject({ landmark: B });
    expect(h.state.paused).toBe(false);
  });

  it('resume while a story is playing resumes the player', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.send({ type: 'PAUSE' });
    expect(types(h.send({ type: 'RESUME' }))).toEqual(['resumePlayback']);
  });

  it('resume also works when the system paused the sound (we never paused)', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    expect(types(h.send({ type: 'RESUME' }))).toEqual(['resumePlayback']);
  });

  it('pausing twice pauses the player once', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.send({ type: 'PAUSE' });
    expect(h.send({ type: 'PAUSE' })).toEqual([]);
  });

  it('a story that arrives while paused waits for resume', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.send({ type: 'PAUSE' });
    const delivered = h.deliver('A');
    expect(commandsOf(delivered, 'play')).toEqual([]);
    expect(h.state.current).toMatchObject({ phase: 'ready' });
    expect(h.state.visited?.ids).toEqual([]); // not heard yet, not visited yet

    const resumed = h.send({ type: 'RESUME' });
    expect(commandsOf(resumed, 'play')[0]).toMatchObject({ landmark: A });
    expect(h.state.visited?.ids).toEqual(['A']);
  });

  it('nothing is picked while paused, even with places nearby', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    h.send({ type: 'PAUSE' });
    const found = h.nearby([A]);
    expect(commandsOf(found, 'fetchNarration')).toEqual([]);
    const resumed = h.send({ type: 'RESUME' });
    expect(commandsOf(resumed, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['A']);
  });

  it('no pre-fetch is started while paused, but one starts on resume', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.send({ type: 'PAUSE' });
    h.fix(MOVED, 0);
    const found = h.nearby([A, B]);
    expect(commandsOf(found, 'prefetch')).toEqual([]);
    const resumed = h.send({ type: 'RESUME' });
    expect(types(resumed)).toEqual(['resumePlayback', 'prefetch']);
  });
});

describe('skip', () => {
  it('stops the story and starts the next one, and the skipped place never returns', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    const cmds = h.send({ type: 'SKIP' });
    expect(types(cmds)).toEqual(['stopPlayback', 'play', 'saveVisited']);
    expect(commandsOf(cmds, 'play')[0]).toMatchObject({ landmark: B });

    // A is excluded for good: a new search offering A and B again picks neither.
    h.fix(MOVED, 0);
    h.nearby([A, B]);
    const after = h.ended();
    expect(commandsOf(after, 'play')).toEqual([]);
    expect(commandsOf(after, 'fetchNarration')).toEqual([]);
  });

  it('un-pauses', () => {
    const h = playingAWithBPrefetching();
    h.deliver('B');
    h.send({ type: 'PAUSE' });
    const cmds = h.send({ type: 'SKIP' });
    expect(h.state.paused).toBe(false);
    expect(types(cmds)).toEqual(['stopPlayback', 'play', 'saveVisited']);
  });

  it('skipping a story still being fetched drops it and keeps the place excluded', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    const cmds = h.send({ type: 'SKIP' });
    expect(commandsOf(cmds, 'stopPlayback')).toEqual([]);
    expect(commandsOf(cmds, 'fetchNarration').map((c) => c.landmarkId)).toEqual(['B']);

    // A's story arrives later: kept, but it does not play and A is not offered again.
    expect(commandsOf(h.deliver('A'), 'play')).toEqual([]);
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'B' } });
    expect(h.state.tourIds).toContain('A');
  });

  it('skipping a story held while paused drops it', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.send({ type: 'PAUSE' });
    h.deliver('A'); // ready
    const cmds = h.send({ type: 'SKIP' });
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.state.current).toBeNull();
    expect(h.state.tourIds).toContain('A');
  });

  it('with nothing to skip does nothing', () => {
    const h = createHarness();
    h.loadVisited();
    h.fix(ORIGIN, 0);
    expect(h.send({ type: 'SKIP' })).toEqual([]);
  });

  it('goes quiet if there is no next place', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    const cmds = h.send({ type: 'SKIP' });
    expect(types(cmds)).toEqual(['stopPlayback']);
    expect(h.state.current).toBeNull();
  });
});

describe('replay', () => {
  function twoStoriesHeard() {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A');
    h.deliver('B');
    h.ended(); // B plays now
    return h;
  }

  it('plays a history item now, with no orientation line and no new history entry', () => {
    const h = twoStoriesHeard();
    const historyBefore = h.state.history;
    const cmds = h.send({ type: 'REPLAY', landmarkId: 'A' });
    expect(types(cmds)).toEqual(['play']);
    expect(commandsOf(cmds, 'play')[0]).toMatchObject({ landmark: A, side: null });
    expect(commandsOf(cmds, 'saveVisited')).toEqual([]);
    expect(h.state.history).toEqual(historyBefore);
    expect(h.state.history).toHaveLength(2);
    expect(h.playingId()).toBe('A');
    expect(h.state.current).toMatchObject({ side: null });
  });

  it('may replace a story that is playing (it is the user asking)', () => {
    const h = twoStoriesHeard();
    h.send({ type: 'REPLAY', landmarkId: 'A' });
    expect(h.playedIds()).toEqual(['A', 'B', 'A']);
    expect(h.violations).toEqual([]);
  });

  it('un-pauses', () => {
    const h = twoStoriesHeard();
    h.send({ type: 'PAUSE' });
    h.send({ type: 'REPLAY', landmarkId: 'A' });
    expect(h.state.paused).toBe(false);
  });

  it('ignores a place that was not narrated in this tour', () => {
    const h = twoStoriesHeard();
    expect(h.send({ type: 'REPLAY', landmarkId: 'nope' })).toEqual([]);
  });

  it('the tour carries on after a replay ends', () => {
    const h = twoStoriesHeard();
    const C = place('C', offsetM(ORIGIN, 120));
    h.send({ type: 'REPLAY', landmarkId: 'A' });
    h.fix(MOVED, 0);
    h.nearby([A, B, C]);
    // Nothing started over the replay (C may be pre-fetched, which does not play)...
    expect(h.playingId()).toBe('A');
    h.ended();
    // ...and C is next once the replay is done, requested once only.
    const requestsForC = [...commandsOf(h.log, 'prefetch'), ...commandsOf(h.log, 'fetchNarration')].filter((c) => c.landmarkId === 'C');
    expect(requestsForC).toHaveLength(1);
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'C' } });
  });

  it('a replay is never dropped as stale, even when driving', () => {
    const h = createHarness({ mode: 'driving' });
    const far = place('far', offsetM(ORIGIN, 500));
    h.begin([far], ORIGIN, 0);
    h.deliver('far');
    h.ended();
    h.fix(offsetM(ORIGIN, 900), 0); // the place is now far behind
    const cmds = h.send({ type: 'REPLAY', landmarkId: 'far' });
    expect(commandsOf(cmds, 'play')[0]).toMatchObject({ landmark: far, side: null });
  });
});

describe('a story whose request is still on its way', () => {
  it('is not requested again after Replay abandoned it', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A'); // B pre-fetching
    h.ended(); // B adopted: fetching
    h.send({ type: 'REPLAY', landmarkId: 'A' }); // abandons B's fetch for the replay
    expect(h.playingId()).toBe('A');
    h.ended(); // the replay ends: B is wanted again
    expect(h.state.current).toMatchObject({ phase: 'fetching', landmark: { id: 'B' } });
    const requestsForB = [...commandsOf(h.log, 'prefetch'), ...commandsOf(h.log, 'fetchNarration')].filter((c) => c.landmarkId === 'B');
    expect(requestsForB).toHaveLength(1);
    expect(commandsOf(h.deliver('B'), 'play')[0]).toMatchObject({ landmark: B });
  });

  it('an abandoned request that comes back is used for the next pick, not wasted', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A'); // B pre-fetching
    h.ended(); // B adopted
    const requestId = h.requestIdFor('B');
    h.send({ type: 'REPLAY', landmarkId: 'A' }); // abandons B
    expect(h.state.current).toMatchObject({ phase: 'playing', landmark: { id: 'A' } });
    // B's story returns while the replay plays: it is kept, and plays after the replay without a new request.
    const cmds = h.send({ type: 'NARRATION_READY', requestId, narration: narrationFor('B') });
    expect(commandsOf(cmds, 'play')).toEqual([]);
    const after = h.ended();
    expect(commandsOf(after, 'fetchNarration')).toEqual([]);
    expect(commandsOf(after, 'play')[0]).toMatchObject({ landmark: B });
  });

  it('is not requested again after Skip abandoned it and a later search offers it', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A'); // B pre-fetching
    h.send({ type: 'SKIP' }); // adopts B's request
    h.send({ type: 'SKIP' }); // abandons it; B stays excluded
    expect(h.state.tourIds).toContain('B');
    const requestsForB = [...commandsOf(h.log, 'prefetch'), ...commandsOf(h.log, 'fetchNarration')].filter((c) => c.landmarkId === 'B');
    expect(requestsForB).toHaveLength(1);
  });
});

describe('a failed playback', () => {
  it('is done (the queue moves on) but holds the next story until the next check', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A');
    h.deliver('B'); // B is ready
    const cmds = h.ended(true); // A could not be played at all
    expect(h.state.current).toBeNull();
    expect(commandsOf(cmds, 'play')).toEqual([]);
    expect(h.state.holdUntilCheck).toBe(true);

    // The next check releases it.
    const next = h.fix(MOVED, 0);
    expect(commandsOf(next, 'play')[0]).toMatchObject({ landmark: B });
    expect(h.violations).toEqual([]);
  });

  it('is retried after about a minute even when standing still', () => {
    const h = createHarness();
    h.begin([A, B], ORIGIN, 0);
    h.deliver('A');
    h.deliver('B');
    h.ended(true);
    expect(commandsOf(h.fix(ORIGIN, 0, { now: NOON + 30_000 }), 'fetchNearby')).toEqual([]);
    const later = h.fix(ORIGIN, 0, { now: NOON + 61_000 });
    expect(commandsOf(later, 'fetchNearby')).toHaveLength(1);
    expect(commandsOf(later, 'play')[0]).toMatchObject({ landmark: B });
  });

  it('a hold stops new story requests until the next check, which clears it', () => {
    const h = createHarness();
    const C = place('C', offsetM(ORIGIN, 120));
    h.begin([A, B, C], ORIGIN, 0);
    h.deliver('A');
    const before = h.log.length;
    h.ended(true);
    expect(commandsOf(h.log.slice(before), 'fetchNarration')).toEqual([]);
    const next = h.fix(MOVED, 0);
    expect(commandsOf(next, 'fetchNearby')).toHaveLength(1);
    expect(h.state.holdUntilCheck).toBe(false);
  });
});
