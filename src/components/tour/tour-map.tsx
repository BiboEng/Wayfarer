import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import type { TravelMode } from '@shared/narration/options';
import { memo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { AppText } from '@/components/app-text';
import { colors, mapStyle, radius, spacing } from '@/theme';
import type { NarratedPlace } from '@/tour/types';

import { ModeChip } from './mode-chip';
import { PositionMarker } from './position-marker';
import { selectPins } from './select-pins';
import { TourPin } from './tour-pin';
import { useFollowPosition } from './use-follow-position';

/** Street level: about one block on foot, a few blocks by car. */
const ZOOM: Record<TravelMode, number> = { walking: 16, driving: 14 };

const MAP_HEIGHT = 190;

/** A whole-world view until the first fix arrives. */
const WORLD_REGION: Region = { latitude: 25, longitude: 10, latitudeDelta: 110, longitudeDelta: 110 };

export interface TourMapProps {
  position: LatLng | null;
  headingDeg: number | null;
  nearby: readonly Landmark[];
  history: readonly NarratedPlace[];
  current: Landmark | null;
  mode: TravelMode;
  modeFixed: boolean;
}

/**
 * Fixed-height map that follows the traveller. Draws its own position marker (not
 * `showsUserLocation`) so simulated routes show up too. Memoized: snapshot updates that do not
 * change these props never reach the native map. The map is not touchable: it is a glance, not a tool.
 */
export const TourMap = memo(function TourMap({
  position,
  headingDeg,
  nearby,
  history,
  current,
  mode,
  modeFixed,
}: TourMapProps) {
  const mapRef = useRef<MapView>(null);
  useFollowPosition(mapRef, position, ZOOM[mode]);

  const narratedIds = new Set(history.map((place) => place.landmark.id));
  const pins = selectPins({ nearby, narratedIds, current });

  return (
    <View style={styles.frame}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        toolbarEnabled={false}
        initialRegion={WORLD_REGION}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        poiClickEnabled={false}
        showsCompass={false}
      >
        {pins.map((pin) => (
          <TourPin key={`${pin.landmark.id}:${pin.state}`} pin={pin} />
        ))}
        {position ? <PositionMarker position={position} headingDeg={headingDeg} /> : null}
      </MapView>
      <View style={styles.chip} pointerEvents="none">
        <ModeChip mode={mode} fixed={modeFixed} />
      </View>
      {position ? null : (
        <View style={styles.waiting} pointerEvents="none" accessibilityLiveRegion="polite">
          <AppText variant="caption" color="text">
            Finding your position…
          </AppText>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    height: MAP_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  waiting: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
