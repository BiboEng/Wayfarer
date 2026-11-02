import { offsetM, ORIGIN, place } from '@/tour/__fixtures__/places';

import { MAX_PINS, selectPins } from '../select-pins';

const A = place('A', offsetM(ORIGIN, 10));
const B = place('B', offsetM(ORIGIN, 20));
const C = place('C', offsetM(ORIGIN, 30));

describe('selectPins', () => {
  it('is empty with nothing nearby and nothing playing', () => {
    expect(selectPins({ nearby: [], narratedIds: new Set(), current: null })).toEqual([]);
  });

  it('marks everything fresh when nothing was narrated', () => {
    expect(selectPins({ nearby: [A, B], narratedIds: new Set(), current: null })).toEqual([
      { landmark: A, state: 'fresh' },
      { landmark: B, state: 'fresh' },
    ]);
  });

  it('puts the current place first, then fresh ones, then narrated ones (dimmed)', () => {
    const pins = selectPins({ nearby: [A, B, C], narratedIds: new Set(['A']), current: C });
    expect(pins.map((p) => [p.landmark.id, p.state])).toEqual([
      ['C', 'current'],
      ['B', 'fresh'],
      ['A', 'narrated'],
    ]);
  });

  it('shows the current place even when it is not in the latest search (a replay)', () => {
    const pins = selectPins({ nearby: [B], narratedIds: new Set(['A']), current: A });
    expect(pins.map((p) => [p.landmark.id, p.state])).toEqual([
      ['A', 'current'],
      ['B', 'fresh'],
    ]);
  });

  it('never lists a place twice', () => {
    const pins = selectPins({ nearby: [A, B], narratedIds: new Set(['A']), current: A });
    expect(pins.filter((p) => p.landmark.id === 'A')).toHaveLength(1);
  });

  it('caps the pins, keeping the current and fresh ones before the narrated', () => {
    const many = Array.from({ length: MAX_PINS + 20 }, (_, i) => place(`P${i}`, offsetM(ORIGIN, i)));
    const narrated = new Set(many.slice(0, 5).map((l) => l.id));
    const pins = selectPins({ nearby: many, narratedIds: narrated, current: many[40] });
    expect(pins).toHaveLength(MAX_PINS);
    expect(pins[0]).toEqual({ landmark: many[40], state: 'current' });
    expect(pins.filter((p) => p.state === 'narrated')).toHaveLength(0);
  });
});
