import { backgroundTrackingOptions, TRACKING_OPTIONS, trackingOptionsFor } from '../tracking-options';

describe('backgroundTrackingOptions', () => {
  it('walking: no distance filter, 3 s', () => {
    expect(backgroundTrackingOptions(trackingOptionsFor('walking'))).toEqual({ accuracy: 'high', distanceIntervalM: 0, timeIntervalMs: 3_000 });
  });
  it('driving: no distance filter, 5 s', () => {
    expect(backgroundTrackingOptions(trackingOptionsFor('driving'))).toEqual({ accuracy: 'high', distanceIntervalM: 0, timeIntervalMs: 5_000 });
  });
  it('does not change the foreground table', () => {
    backgroundTrackingOptions(TRACKING_OPTIONS.walking);
    expect(TRACKING_OPTIONS.walking.distanceIntervalM).toBe(10);
    expect(TRACKING_OPTIONS.driving.distanceIntervalM).toBe(30);
  });
});
