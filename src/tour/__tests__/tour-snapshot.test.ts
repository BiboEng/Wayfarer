import { commandsOf, createHarness } from '../__fixtures__/machine-harness';
import { offsetM, ORIGIN, place } from '../__fixtures__/places';
import { initialTourState } from '../tour-machine';
import { currentNarration, sameSnapshot, toTourSnapshot, type SessionPhase } from '../tour-snapshot';

const A = place('A', offsetM(ORIGIN, 100));

const IDLE = initialTourState('walking');
const snapshotOf = (
  machine = IDLE,
  over: { phase?: SessionPhase; playerPaused?: boolean; modeFixed?: boolean; displayPosition?: { lat: number; lng: number } | null } = {},
) =>
  toTourSnapshot({
    phase: over.phase ?? 'running',
    source: 'gps',
    machine,
    modeFixed: over.modeFixed ?? false,
    playerPaused: over.playerPaused ?? false,
    displayPosition: over.displayPosition,
  });

describe('toTourSnapshot status', () => {
  it.each(['idle', 'needs-permission', 'permission-denied', 'location-approximate', 'location-off'] as const)('outside a running tour the status is the phase (%s)', (phase) => {
    expect(snapshotOf(undefined, { phase }).status).toBe(phase);
  });

  it('is listening when running with nothing to say', () => {
    expect(snapshotOf().status).toBe('listening');
  });

  it('is preparing while the story is fetched, then narrating, then listening', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    expect(snapshotOf(h.state).status).toBe('preparing');
    h.deliver('A');
    expect(snapshotOf(h.state).status).toBe('narrating');
    h.ended();
    expect(snapshotOf(h.state).status).toBe('listening');
  });

  it('is paused when the user paused', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    h.send({ type: 'PAUSE' });
    expect(snapshotOf(h.state).status).toBe('paused');
  });

  it('is paused when the system paused the story (audio focus lost)', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    h.deliver('A');
    expect(snapshotOf(h.state, { playerPaused: true }).status).toBe('paused');
  });

  it('a paused player without a tour story playing does not show paused', () => {
    expect(snapshotOf(undefined, { playerPaused: true }).status).toBe('listening');
  });
});

describe('toTourSnapshot content', () => {
  it('the position is the latest fix, even a rough one the tour ignored', () => {
    const h = createHarness();
    h.begin([], ORIGIN, 0);
    const rough = offsetM(ORIGIN, 300);
    expect(snapshotOf(h.state, { displayPosition: rough }).position).toBe(rough);
    expect(snapshotOf(h.state).position).toEqual(ORIGIN);
    expect(snapshotOf(h.state, { displayPosition: null }).position).toEqual(ORIGIN);
  });

  it('exposes mode, modeFixed, source, history and nearby', () => {
    const h = createHarness({ mode: 'driving' });
    h.begin([place('far', offsetM(ORIGIN, 500))], ORIGIN, 0);
    h.deliver('far');
    const snap = snapshotOf(h.state, { modeFixed: true });
    expect(snap).toMatchObject({ mode: 'driving', modeFixed: true, source: 'gps', position: ORIGIN, headingDeg: 0 });
    expect(snap.history.map((item) => item.landmark.id)).toEqual(['far']);
    expect(snap.nearby.map((l) => l.id)).toEqual(['far']);
  });

  it('current has empty text while preparing and the story text when playing', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    expect(currentNarration(h.state)).toMatchObject({ landmark: { id: 'A' }, text: '' });
    h.deliver('A');
    expect(currentNarration(h.state)).toEqual({ landmark: A, side: 'ahead', text: 'The story of A.' });
  });

  it('current is null when there is no story', () => {
    expect(currentNarration(initialTourState('walking'))).toBeNull();
  });
});

describe('sameSnapshot', () => {
  it('is true for the same content', () => {
    expect(sameSnapshot(snapshotOf(), snapshotOf())).toBe(true);
  });

  it('is false when any rendered part changes', () => {
    const base = snapshotOf();
    expect(sameSnapshot(base, snapshotOf(undefined, { phase: 'idle' }))).toBe(false);
    expect(sameSnapshot(base, snapshotOf(undefined, { modeFixed: true }))).toBe(false);
    expect(sameSnapshot(base, { ...base, mode: 'driving' })).toBe(false);
    expect(sameSnapshot(base, { ...base, position: ORIGIN })).toBe(false);
    expect(sameSnapshot(base, { ...base, headingDeg: 10 })).toBe(false);
    expect(sameSnapshot(base, { ...base, nearby: [A] })).toBe(false);
    expect(sameSnapshot(base, { ...base, history: [{ landmark: A, narratedAt: 1 }] })).toBe(false);
    expect(sameSnapshot(base, { ...base, source: 'sim-walk' })).toBe(false);
  });

  it('compares the current story', () => {
    const h = createHarness();
    h.begin([A], ORIGIN, 0);
    const preparing = snapshotOf(h.state);
    h.deliver('A');
    const narrating = snapshotOf(h.state);
    expect(sameSnapshot(preparing, narrating)).toBe(false);
    expect(sameSnapshot(narrating, snapshotOf(h.state))).toBe(true);
    expect(sameSnapshot(snapshotOf(), narrating)).toBe(false);
    expect(commandsOf(h.log, 'play')).toHaveLength(1);
  });
});
