import type { LatLng } from '@shared/geo/lat-lng';

import {
  exploreNarrationId,
  exploreReducer,
  INITIAL_EXPLORE_STATE,
  tappedPoint,
  type ExploreFlowState,
} from '../explore-flow';
import { error, LANDMARK, NARRATION } from '../__fixtures__/explore-fixtures';

const POINT: LatLng = { lat: 51.5, lng: -0.07 };
const OTHER_POINT: LatLng = { lat: 48.85, lng: 2.35 };

const searching = (requestId = 1): ExploreFlowState => exploreReducer(INITIAL_EXPLORE_STATE, { type: 'TAP', requestId, point: POINT });
const found = (requestId = 1): ExploreFlowState =>
  exploreReducer(searching(requestId), { type: 'SEARCH_DONE', requestId, landmark: LANDMARK, searchedRadiusMeters: 2000 });

describe('exploreReducer', () => {
  it('starts idle', () => {
    expect(INITIAL_EXPLORE_STATE.current).toEqual({ step: 'idle' });
  });

  it('TAP moves to searching and remembers the point and request id', () => {
    expect(searching(7)).toEqual({ requestId: 7, current: { step: 'searching', tap: POINT } });
  });

  it('SEARCH_DONE with a landmark moves to found and starts requesting the narration', () => {
    expect(found().current).toEqual({ step: 'found', tap: POINT, landmark: LANDMARK, narration: { status: 'requesting' } });
  });

  it('SEARCH_DONE with null moves to nothing and keeps the searched radius', () => {
    const state = exploreReducer(searching(), { type: 'SEARCH_DONE', requestId: 1, landmark: null, searchedRadiusMeters: 10_000 });
    expect(state.current).toEqual({ step: 'nothing', tap: POINT, radiusMeters: 10_000 });
  });

  it('SEARCH_FAILED moves to search-failed with the error', () => {
    const state = exploreReducer(searching(), { type: 'SEARCH_FAILED', requestId: 1, error: error('UPSTREAM_FAILED') });
    expect(state.current).toEqual({ step: 'search-failed', tap: POINT, error: error('UPSTREAM_FAILED') });
  });

  it('NARRATION_DONE stores the narration', () => {
    const state = exploreReducer(found(), { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION });
    expect(state.current).toMatchObject({ step: 'found', narration: { status: 'ready', narration: NARRATION } });
  });

  it('NARRATION_FAILED stores the error', () => {
    const state = exploreReducer(found(), { type: 'NARRATION_FAILED', requestId: 1, error: error('NOT_NARRATABLE') });
    expect(state.current).toMatchObject({ step: 'found', narration: { status: 'failed', error: error('NOT_NARRATABLE') } });
  });

  it('keeps the landmark and tap when the narration finishes', () => {
    const state = exploreReducer(found(), { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION });
    expect(state.current).toMatchObject({ tap: POINT, landmark: LANDMARK });
  });

  describe('stale events (other request id)', () => {
    it('ignores SEARCH_DONE from an older tap', () => {
      const state = searching(2);
      expect(exploreReducer(state, { type: 'SEARCH_DONE', requestId: 1, landmark: LANDMARK, searchedRadiusMeters: 2000 })).toBe(state);
    });

    it('ignores SEARCH_FAILED from an older tap', () => {
      const state = searching(2);
      expect(exploreReducer(state, { type: 'SEARCH_FAILED', requestId: 1, error: error('TIMEOUT') })).toBe(state);
    });

    it('ignores NARRATION_DONE from an older tap', () => {
      const state = found(2);
      expect(exploreReducer(state, { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION })).toBe(state);
    });

    it('ignores NARRATION_FAILED from an older tap', () => {
      const state = found(2);
      expect(exploreReducer(state, { type: 'NARRATION_FAILED', requestId: 1, error: error('TIMEOUT') })).toBe(state);
    });

    it('ignores events from a future request id too (only the latest tap counts)', () => {
      const state = searching(2);
      expect(exploreReducer(state, { type: 'SEARCH_DONE', requestId: 3, landmark: LANDMARK, searchedRadiusMeters: 2000 })).toBe(state);
    });
  });

  describe('a new TAP', () => {
    it('replaces a narration in progress', () => {
      const state = exploreReducer(found(1), { type: 'TAP', requestId: 2, point: OTHER_POINT });
      expect(state).toEqual({ requestId: 2, current: { step: 'searching', tap: OTHER_POINT } });
    });

    it('replaces a ready narration', () => {
      const ready = exploreReducer(found(1), { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION });
      expect(exploreReducer(ready, { type: 'TAP', requestId: 2, point: OTHER_POINT }).current).toEqual({ step: 'searching', tap: OTHER_POINT });
    });

    it('replaces nothing / search-failed results', () => {
      const nothing = exploreReducer(searching(1), { type: 'SEARCH_DONE', requestId: 1, landmark: null, searchedRadiusMeters: 10_000 });
      expect(exploreReducer(nothing, { type: 'TAP', requestId: 2, point: OTHER_POINT }).current.step).toBe('searching');
      const failed = exploreReducer(searching(1), { type: 'SEARCH_FAILED', requestId: 1, error: error('TIMEOUT') });
      expect(exploreReducer(failed, { type: 'TAP', requestId: 2, point: OTHER_POINT }).current.step).toBe('searching');
    });

    it('makes the old narration result stale', () => {
      const retapped = exploreReducer(found(1), { type: 'TAP', requestId: 2, point: OTHER_POINT });
      expect(exploreReducer(retapped, { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION })).toBe(retapped);
    });
  });

  describe('events in the wrong step are ignored', () => {
    it('NARRATION_DONE / NARRATION_FAILED while searching', () => {
      const state = searching();
      expect(exploreReducer(state, { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION })).toBe(state);
      expect(exploreReducer(state, { type: 'NARRATION_FAILED', requestId: 1, error: error('TIMEOUT') })).toBe(state);
    });

    it('a second NARRATION_DONE does not replace the first', () => {
      const ready = exploreReducer(found(), { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION });
      const again = { ...NARRATION, text: 'Different text.' };
      expect(exploreReducer(ready, { type: 'NARRATION_DONE', requestId: 1, narration: again })).toBe(ready);
    });

    it('NARRATION_FAILED after NARRATION_DONE is ignored', () => {
      const ready = exploreReducer(found(), { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION });
      expect(exploreReducer(ready, { type: 'NARRATION_FAILED', requestId: 1, error: error('TIMEOUT') })).toBe(ready);
    });

    it('NARRATION_DONE after NARRATION_FAILED is ignored', () => {
      const failed = exploreReducer(found(), { type: 'NARRATION_FAILED', requestId: 1, error: error('TIMEOUT') });
      expect(exploreReducer(failed, { type: 'NARRATION_DONE', requestId: 1, narration: NARRATION })).toBe(failed);
    });

    it('SEARCH_DONE / SEARCH_FAILED after the search already finished', () => {
      const state = found();
      expect(exploreReducer(state, { type: 'SEARCH_DONE', requestId: 1, landmark: null, searchedRadiusMeters: 10_000 })).toBe(state);
      expect(exploreReducer(state, { type: 'SEARCH_FAILED', requestId: 1, error: error('TIMEOUT') })).toBe(state);
    });

    it('any result event while idle', () => {
      const idle: ExploreFlowState = { requestId: 0, current: { step: 'idle' } };
      expect(exploreReducer(idle, { type: 'SEARCH_DONE', requestId: 0, landmark: LANDMARK, searchedRadiusMeters: 2000 })).toBe(idle);
      expect(exploreReducer(idle, { type: 'NARRATION_DONE', requestId: 0, narration: NARRATION })).toBe(idle);
    });
  });

  it('does not mutate the previous state', () => {
    const before = searching();
    const snapshot = JSON.stringify(before);
    exploreReducer(before, { type: 'SEARCH_DONE', requestId: 1, landmark: LANDMARK, searchedRadiusMeters: 2000 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('tappedPoint', () => {
  it('is null when idle', () => {
    expect(tappedPoint(INITIAL_EXPLORE_STATE)).toBeNull();
  });

  it.each([
    ['searching', searching()],
    ['found', found()],
    ['nothing', exploreReducer(searching(), { type: 'SEARCH_DONE', requestId: 1, landmark: null, searchedRadiusMeters: 10_000 })],
    ['search-failed', exploreReducer(searching(), { type: 'SEARCH_FAILED', requestId: 1, error: error('TIMEOUT') })],
  ])('is the tapped point in the %s step', (_name, state) => {
    expect(tappedPoint(state)).toEqual(POINT);
  });
});

describe('exploreNarrationId', () => {
  it('is stable per request and differs between requests', () => {
    expect(exploreNarrationId(3)).toBe(exploreNarrationId(3));
    expect(exploreNarrationId(3)).not.toBe(exploreNarrationId(4));
  });
});
