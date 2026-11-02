import type { Landmark } from '@shared/landmarks/landmark';

/** `current` is being narrated, `narrated` was heard already (dimmed), `fresh` is still to come. */
export type PinState = 'current' | 'narrated' | 'fresh';

export interface MapPin {
  landmark: Landmark;
  state: PinState;
}

/** More pins than this only clutter a small map and slow the native view down. */
export const MAX_PINS = 30;

export interface SelectPinsInput {
  nearby: readonly Landmark[];
  narratedIds: ReadonlySet<string>;
  current: Landmark | null;
}

/**
 * Pins for the mini map: the current place first (even when it is no longer in the latest
 * search, e.g. a replay), then the places still to come, then narrated ones, capped at MAX_PINS.
 */
export function selectPins({ nearby, narratedIds, current }: SelectPinsInput): MapPin[] {
  const pins: MapPin[] = [];
  if (current) pins.push({ landmark: current, state: 'current' });

  const others = nearby.filter((landmark) => landmark.id !== current?.id);
  for (const landmark of others) {
    if (!narratedIds.has(landmark.id)) pins.push({ landmark, state: 'fresh' });
  }
  for (const landmark of others) {
    if (narratedIds.has(landmark.id)) pins.push({ landmark, state: 'narrated' });
  }
  return pins.slice(0, MAX_PINS);
}
