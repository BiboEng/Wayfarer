import { StyleSheet, View } from 'react-native';

import { StaticMarker } from '@/components/map/static-marker';
import { colors } from '@/theme';

import type { MapCoordinate } from './fit-points';

/** Pins draw above the country names. */
const PIN_Z_INDEX = 10;

/** Small, subtle dot where the user tapped. */
export function TappedMarker({ coordinate }: { coordinate: MapCoordinate }) {
  return (
    <StaticMarker coordinate={coordinate} label="Tapped spot" zIndex={PIN_Z_INDEX}>
      <View style={styles.tapped} />
    </StaticMarker>
  );
}

/** Accent-coloured pin on the landmark. */
export function LandmarkPin({ coordinate, title }: { coordinate: MapCoordinate; title: string }) {
  return (
    <StaticMarker coordinate={coordinate} label={title} zIndex={PIN_Z_INDEX}>
      <View style={styles.pinOuter}>
        <View style={styles.pinInner} />
      </View>
    </StaticMarker>
  );
}

const styles = StyleSheet.create({
  tapped: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textSecondary,
    borderWidth: 2,
    borderColor: colors.background,
    opacity: 0.8,
  },
  pinOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textOnAccent },
});
