import { StyleSheet, View } from 'react-native';

import { LandmarkPin } from '@/components/explore/map-pins';
import { StaticMarker } from '@/components/map/static-marker';
import { colors } from '@/theme';

import type { MapPin } from './select-pins';

const PIN_Z_INDEX = 10;
/** Narrated pins sit under the others. */
const NARRATED_Z_INDEX = 5;

/**
 * One place on the mini map. The look depends on its state, so the parent keys it by id and
 * state: a state change remounts the marker, which snapshots the new look once and then stops
 * redrawing.
 */
export function TourPin({ pin }: { pin: MapPin }) {
  const { landmark, state } = pin;
  const coordinate = { latitude: landmark.location.lat, longitude: landmark.location.lng };

  if (state === 'current') {
    return <LandmarkPin coordinate={coordinate} title={landmark.name} />;
  }
  const narrated = state === 'narrated';
  return (
    <StaticMarker
      coordinate={coordinate}
      label={narrated ? `${landmark.name}, already heard` : landmark.name}
      zIndex={narrated ? NARRATED_Z_INDEX : PIN_Z_INDEX}
    >
      <View style={narrated ? styles.narrated : styles.fresh} />
    </StaticMarker>
  );
}

const styles = StyleSheet.create({
  fresh: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.text,
  },
  narrated: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.textSecondary,
    borderWidth: 2,
    borderColor: colors.background,
    opacity: 0.45,
  },
});
