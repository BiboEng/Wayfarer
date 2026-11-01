import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';

import { exploreNarrationId, exploreReducer, INITIAL_EXPLORE_STATE, type ExploreFlowState } from '../explore-flow';
import { toExploreView, type PlayerSnapshot } from '../to-explore-view';
import { error, LANDMARK, NARRATION } from '../__fixtures__/explore-fixtures';

const TAP: LatLng = { lat: 51.5, lng: -0.07 };
const IDLE_PLAYER: PlayerSnapshot = { status: 'idle', narrationId: null, output: null };
const ID = exploreNarrationId(1);
const player = (status: PlayerSnapshot['status'], narrationId: string | null = ID, output: PlayerSnapshot['output'] = 'audio'): PlayerSnapshot => ({
  status,
  narrationId,
  output,
});

const searching = exploreReducer(INITIAL_EXPLORE_STATE, { type: 'TAP', requestId: 1, point: TAP });
const found = exploreReducer(searching, { type: 'SEARCH_DONE', requestId: 1, landmark: LANDMARK, searchedRadiusMeters: 2000 });
const ready = exploreReducer(found, { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION });
const narrationFailed = (code: Parameters<typeof error>[0]): ExploreFlowState =>
  exploreReducer(found, { type: 'NARRATION_FAILED', requestId: 1, error: error(code) });

function narrationOf(state: ExploreFlowState, snapshot: PlayerSnapshot) {
  const view = toExploreView(state, snapshot);
  if (view.kind !== 'landmark') throw new Error(`expected landmark view, got ${view.kind}`);
  return view.narration;
}

describe('toExploreView', () => {
  it('idle -> hint', () => {
    expect(toExploreView(INITIAL_EXPLORE_STATE, IDLE_PLAYER)).toEqual({ kind: 'hint' });
  });

  it('searching -> searching', () => {
    expect(toExploreView(searching, IDLE_PLAYER)).toEqual({ kind: 'searching' });
  });

  describe('nothing', () => {
    const nothing = (radiusMeters: number) =>
      exploreReducer(searching, { type: 'SEARCH_DONE', requestId: 1, landmark: null, searchedRadiusMeters: radiusMeters });

    it.each([
      [10_000, 10],
      [2000, 2],
      [1499, 1],
      [1500, 2],
      [25_000, 25],
    ])('%i m -> %i km', (meters, km) => {
      expect(toExploreView(nothing(meters), IDLE_PLAYER)).toEqual({ kind: 'nothing', radiusKm: km });
    });
  });

  it('search-failed -> error with a message', () => {
    const state = exploreReducer(searching, { type: 'SEARCH_FAILED', requestId: 1, error: error('NETWORK_ERROR') });
    const view = toExploreView(state, IDLE_PLAYER);
    expect(view.kind).toBe('error');
    expect(view.kind === 'error' && view.message.length).toBeGreaterThan(0);
  });

  describe('found', () => {
    it('carries the landmark and the tap-to-landmark distance', () => {
      const view = toExploreView(found, IDLE_PLAYER);
      expect(view).toMatchObject({ kind: 'landmark', landmark: LANDMARK });
      expect(view.kind === 'landmark' && view.distanceMeters).toBeCloseTo(distanceMeters(TAP, LANDMARK.location), 6);
      expect(view.kind === 'landmark' && view.distanceMeters).toBeGreaterThan(0);
    });

    it('requesting -> writing', () => {
      expect(narrationOf(found, IDLE_PLAYER)).toEqual({ status: 'writing' });
    });

    it('requesting stays writing even if the player is busy with something else', () => {
      expect(narrationOf(found, player('playing', 'tour:other'))).toEqual({ status: 'writing' });
    });

    it.each(['NOT_NARRATABLE', 'NOT_FOUND'] as const)('%s -> unavailable, not retryable', (code) => {
      const view = narrationOf(narrationFailed(code), IDLE_PLAYER);
      expect(view).toMatchObject({ status: 'unavailable', retryable: false });
      expect(view).not.toHaveProperty('text');
    });

    it('network error -> unavailable, retryable', () => {
      expect(narrationOf(narrationFailed('NETWORK_ERROR'), IDLE_PLAYER)).toMatchObject({ status: 'unavailable', retryable: true });
    });

    it('ready + player loading this narration -> starting with the text', () => {
      expect(narrationOf(ready, player('loading'))).toEqual({ status: 'starting', text: NARRATION.text });
    });

    it.each(['playing', 'paused'] as const)('ready + player %s -> carries output and text', (status) => {
      expect(narrationOf(ready, player(status, ID, 'audio'))).toEqual({ status, output: 'audio', text: NARRATION.text });
      expect(narrationOf(ready, player(status, ID, 'device-voice'))).toEqual({ status, output: 'device-voice', text: NARRATION.text });
    });

    it('ready + player ended -> ended', () => {
      expect(narrationOf(ready, player('ended'))).toEqual({ status: 'ended', text: NARRATION.text });
    });

    it('ready + player idle with this id -> ended', () => {
      expect(narrationOf(ready, player('idle'))).toEqual({ status: 'ended', text: NARRATION.text });
    });

    it('ready + player idle with no id (stopped) -> ended', () => {
      expect(narrationOf(ready, IDLE_PLAYER)).toEqual({ status: 'ended', text: NARRATION.text });
    });

    it.each(['loading', 'playing', 'paused', 'failed'] as const)('ready + player %s for another narration -> ended', (status) => {
      expect(narrationOf(ready, player(status, 'tour:other'))).toEqual({ status: 'ended', text: NARRATION.text });
    });

    it('does not mistake a narration from an older tap for this one', () => {
      expect(narrationOf(ready, player('playing', exploreNarrationId(0)))).toMatchObject({ status: 'ended' });
    });

    it('ready + player failed -> unavailable, keeps the text', () => {
      expect(narrationOf(ready, player('failed', ID, 'device-voice'))).toMatchObject({
        status: 'unavailable',
        text: NARRATION.text,
      });
    });
  });
});
