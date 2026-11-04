/** Maps our accuracy levels to expo-location's. Shared by the foreground watch and the background task. */
import * as Location from 'expo-location';

import type { TrackingAccuracy } from './types';

const ACCURACY: Record<TrackingAccuracy, Location.Accuracy> = {
  balanced: Location.Accuracy.Balanced,
  high: Location.Accuracy.High,
};

export function toExpoAccuracy(accuracy: TrackingAccuracy): Location.Accuracy {
  return ACCURACY[accuracy];
}
