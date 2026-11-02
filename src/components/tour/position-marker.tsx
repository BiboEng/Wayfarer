import type { LatLng } from '@shared/geo/lat-lng';
import { StyleSheet, View } from 'react-native';

import { StaticMarker } from '@/components/map/static-marker';
import { colors } from '@/theme';

/** Above all place pins. */
const POSITION_Z_INDEX = 20;

export interface PositionMarkerProps {
  position: LatLng;
  /** Direction of travel, degrees clockwise from north; null while it is unknown. */
  headingDeg: number | null;
}

/**
 * "You are here": a dot, with an arrow in the direction of travel once there is one.
 * The arrow turns through the marker's native `rotation`; the look is only re-drawn when the
 * arrow appears or disappears (the key), so heading changes cost nothing.
 */
export function PositionMarker({ position, headingDeg }: PositionMarkerProps) {
  const hasHeading = headingDeg !== null;
  return (
    <StaticMarker
      key={hasHeading ? 'arrow' : 'dot'}
      coordinate={{ latitude: position.lat, longitude: position.lng }}
      label="Your position"
      zIndex={POSITION_Z_INDEX}
      rotation={headingDeg ?? 0}
      flat={hasHeading}
    >
      <View style={styles.box}>
        {hasHeading ? <View style={styles.arrow} /> : null}
        <View style={styles.dot} />
      </View>
    </StaticMarker>
  );
}

const BOX = 44;
const DOT = 20;

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.text,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  arrow: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.text,
  },
});
