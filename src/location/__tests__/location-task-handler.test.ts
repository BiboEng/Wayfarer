import type { LocationObject } from 'expo-location';

import { createLocationTaskHandler } from '../location-task-handler';

const loc = (latitude: number, over: Partial<LocationObject['coords']> = {}): LocationObject => ({
  coords: { latitude, longitude: 2, accuracy: 4, altitude: null, altitudeAccuracy: null, heading: -1, speed: 1.5, ...over },
  timestamp: latitude * 1000,
});

function setup() {
  const stop = jest.fn();
  const handler = createLocationTaskHandler(stop);
  const onFix = jest.fn();
  const onError = jest.fn();
  return { handler, stop, onFix, onError };
}

describe('createLocationTaskHandler', () => {
  it('delivers only the newest fix of a batch, converted', () => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix });
    t.handler.handle({ data: { locations: [loc(1), loc(2), loc(3)] }, error: null });
    expect(t.onFix.mock.calls.map(([f]) => f.lat)).toEqual([3]);
    expect(t.onFix.mock.calls[0][0]).toEqual({ lat: 3, lng: 2, accuracyM: 4, speedMps: 1.5, headingDeg: null, timestamp: 3000 });
    expect(t.stop).not.toHaveBeenCalled();
  });

  it('picks the newest by timestamp, whatever the batch order', () => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix });
    t.handler.handle({ data: { locations: [loc(3), loc(1), loc(2)] }, error: null });
    expect(t.onFix.mock.calls.map(([f]) => f.timestamp)).toEqual([3000]);
  });

  it('reports an error to onError and delivers no fixes', () => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix, onError: t.onError });
    t.handler.handle({ data: { locations: [loc(1)] }, error: { message: 'boom' } });
    expect(t.onError).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(t.onFix).not.toHaveBeenCalled();
  });

  it('ignores an error quietly when there is no onError', () => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix });
    expect(() => t.handler.handle({ data: null, error: { message: 'x' } })).not.toThrow();
  });

  it('with no listener, stops the stray updates and delivers nothing', () => {
    const t = setup();
    t.handler.handle({ data: { locations: [loc(1)] }, error: null });
    expect(t.stop).toHaveBeenCalledTimes(1);
    t.handler.setListener({ onFix: t.onFix });
    t.handler.setListener(null);
    t.handler.handle({ data: { locations: [loc(1)] }, error: null });
    expect(t.stop).toHaveBeenCalledTimes(2);
    expect(t.onFix).not.toHaveBeenCalled();
  });

  it.each([null, undefined, 5, {}, { locations: 'x' }, { locations: [null, {}, { coords: {} }] }])('malformed data %p gives no fixes and no throw', (data) => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix });
    expect(() => t.handler.handle({ data, error: null })).not.toThrow();
    expect(t.onFix).not.toHaveBeenCalled();
  });

  it('skips malformed entries but keeps good ones', () => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix });
    t.handler.handle({ data: { locations: [null, loc(4)] }, error: null });
    expect(t.onFix).toHaveBeenCalledTimes(1);
  });

  it('delivers one fix per batch even when every entry is good', () => {
    const t = setup();
    t.handler.setListener({ onFix: t.onFix });
    t.handler.handle({ data: { locations: [loc(1), loc(2)] }, error: null });
    t.handler.handle({ data: { locations: [loc(5), loc(6), loc(7)] }, error: null });
    expect(t.onFix.mock.calls.map(([f]) => f.lat)).toEqual([2, 7]);
  });
});
