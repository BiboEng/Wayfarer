import type { Landmark } from '@shared/landmarks/landmark';

import { MODE_PROFILES } from '../mode-profile';
import { offsetM, ORIGIN, place, placeWithoutWikipedia } from '../__fixtures__/places';
import { bestCandidate, rankCandidates, type RankContext } from '../ranking';

const walking = (over: Partial<RankContext> = {}): RankContext => ({
  position: ORIGIN,
  headingDeg: 0,
  profile: MODE_PROFILES.walking,
  excluded: new Set(),
  ...over,
});
const driving = (over: Partial<RankContext> = {}): RankContext => walking({ profile: MODE_PROFILES.driving, ...over });

const ids = (landmarks: Landmark[], context: RankContext) => rankCandidates(landmarks, context).map((c) => c.landmark.id);

describe('what qualifies', () => {
  it('needs a Wikipedia article', () => {
    expect(ids([placeWithoutWikipedia('a', offsetM(ORIGIN, 50))], walking())).toEqual([]);
  });

  it('must be inside the radius (walking 200 m)', () => {
    expect(ids([place('in', offsetM(ORIGIN, 190)), place('out', offsetM(ORIGIN, 210))], walking())).toEqual(['in']);
  });

  it('must be inside the radius (driving 800 m)', () => {
    expect(ids([place('in', offsetM(ORIGIN, 790)), place('out', offsetM(ORIGIN, 810))], driving())).toEqual(['in']);
  });

  it('skips excluded ids', () => {
    const list = [place('a', offsetM(ORIGIN, 50)), place('b', offsetM(ORIGIN, 80))];
    expect(ids(list, walking({ excluded: new Set(['a']) }))).toEqual(['b']);
  });

  it('is empty (stay silent) with nothing nearby', () => {
    expect(rankCandidates([], walking())).toEqual([]);
    expect(bestCandidate([], walking())).toBeNull();
  });

  it('is empty when everything is excluded', () => {
    expect(bestCandidate([place('a', offsetM(ORIGIN, 50))], walking({ excluded: new Set(['a']) }))).toBeNull();
  });
});

describe('ordering', () => {
  it('closer wins among equals (same side)', () => {
    const list = [place('far', offsetM(ORIGIN, 150)), place('near', offsetM(ORIGIN, 40)), place('mid', offsetM(ORIGIN, 90))];
    expect(ids(list, walking())).toEqual(['near', 'mid', 'far']);
  });

  it('ahead beats behind, even when the one behind is a bit closer (walking)', () => {
    const list = [place('behind', offsetM(ORIGIN, -60)), place('ahead', offsetM(ORIGIN, 80))];
    expect(ids(list, walking())).toEqual(['ahead', 'behind']);
  });

  it('ahead beats a place to the side at the same distance', () => {
    const list = [place('side', offsetM(ORIGIN, 0, 100)), place('ahead', offsetM(ORIGIN, 100))];
    expect(ids(list, walking())).toEqual(['ahead', 'side']);
  });

  it('a place behind is still possible when walking and nothing else qualifies', () => {
    expect(ids([place('behind', offsetM(ORIGIN, -60))], walking())).toEqual(['behind']);
  });

  it('driving drops places behind entirely', () => {
    expect(ids([place('behind', offsetM(ORIGIN, -300))], driving())).toEqual([]);
    expect(ids([place('behind', offsetM(ORIGIN, -300)), place('ahead', offsetM(ORIGIN, 600))], driving())).toEqual(['ahead']);
  });

  it('driving keeps places to the side', () => {
    expect(ids([place('side', offsetM(ORIGIN, 100, 300))], driving())).toEqual(['side']);
  });

  it('without a heading nothing is called ahead or behind, and nothing is dropped', () => {
    const ranked = rankCandidates([place('a', offsetM(ORIGIN, -300)), place('b', offsetM(ORIGIN, 400))], driving({ headingDeg: null }));
    expect(ranked.map((c) => c.side)).toEqual([null, null]);
    expect(ranked.map((c) => c.landmark.id)).toEqual(['a', 'b']);
  });

  it('reports distance and side for each candidate', () => {
    const [first] = rankCandidates([place('a', offsetM(ORIGIN, 100))], walking());
    expect(first.distanceM).toBeCloseTo(100, 0);
    expect(first.side).toBe('ahead');
  });

  it('is deterministic on ties (by id)', () => {
    const at = offsetM(ORIGIN, 100);
    expect(ids([place('b', at), place('a', at)], walking())).toEqual(['a', 'b']);
  });
});

describe('probable non-places', () => {
  const unknownKind = (id: string, at = offsetM(ORIGIN, 60)) => place(id, at, { kind: 'other', osmTags: undefined });
  const event = (id: string, at = offsetM(ORIGIN, 20)) =>
    place(id, at, { kind: 'other', osmTags: undefined, name: '740 Constantinople earthquake' });

  it('an event is pushed down below a real place that is farther away', () => {
    const list = [event('quake', offsetM(ORIGIN, 20)), place('real', offsetM(ORIGIN, 190))];
    expect(ids(list, walking())).toEqual(['real', 'quake']);
  });

  it('an event is still possible when nothing else qualifies', () => {
    expect(ids([event('quake')], walking())).toEqual(['quake']);
  });

  it('an unknown kind with no OSM tags is pushed down, but less than an event', () => {
    const at = offsetM(ORIGIN, 100);
    expect(ids([event('quake', at), unknownKind('mystery', at), place('real', at)], walking())).toEqual(['real', 'mystery', 'quake']);
  });

  it("a 'other' place with OSM tags is a real place", () => {
    const tagged = place('tagged', offsetM(ORIGIN, 100), { kind: 'other', osmTags: { tourism: 'attraction' } });
    const list = [tagged, place('real', offsetM(ORIGIN, 105))];
    expect(ids(list, walking())).toEqual(['tagged', 'real']);
  });

  it('a recognised kind is never treated as a non-place, even with an event-like title', () => {
    const battle = place('battle', offsetM(ORIGIN, 30), { name: 'Battle Monument', kind: 'monument' });
    expect(ids([battle, place('far', offsetM(ORIGIN, 150))], walking())).toEqual(['battle', 'far']);
  });

  it.each(['1453 Fall of Constantinople', 'Great Fire of London', 'Gezi Park protests', 'Siege of Vienna'])(
    'spots the event title %s',
    (name) => {
      const list = [place('x', offsetM(ORIGIN, 10), { name, kind: 'other', osmTags: {} }), place('real', offsetM(ORIGIN, 180))];
      expect(ids(list, walking())[0]).toBe('real');
    },
  );
});
