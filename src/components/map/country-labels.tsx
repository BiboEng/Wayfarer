import { memo } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';

import { colors, fontFamily } from '@/theme';

import { COUNTRY_LABELS } from './country-labels.data';
import { StaticMarker } from './static-marker';
import { visibleLabels, type CountryLabel, type LabelRegion } from './visible-labels';

/** More labels than this make Android's marker layer stutter. */
const DEFAULT_MAX_LABELS = 50;
const ID_PREFIX = 'country:';

/** True for the `id` of a press event that came from one of the country-name markers. */
export function isCountryMarkerId(id: string | undefined): boolean {
  return id?.startsWith(ID_PREFIX) ?? false;
}

export interface CountryLabelsProps {
  /** The map's current region (use `onRegionChangeComplete`, not every frame). `null` until known. */
  region: LabelRegion | null;
  maxCount?: number;
}

/**
 * The app's own country names, drawn as markers. Render inside a MapView, with
 * Google's own country labels hidden in the map style. Google markers cannot
 * be click-through: a tap on a name arrives as `onMarkerPress` (see `isCountryMarkerId`).
 */
export function CountryLabels({ region, maxCount = DEFAULT_MAX_LABELS }: CountryLabelsProps) {
  const { width } = useWindowDimensions();
  if (!region) return null;
  return (
    <>
      {visibleLabels(COUNTRY_LABELS, region, maxCount, width).map((label) => (
        <CountryName key={label.name} label={label} />
      ))}
    </>
  );
}

const CountryName = memo(function CountryName({ label }: { label: CountryLabel }) {
  return (
    <StaticMarker
      coordinate={{ latitude: label.lat, longitude: label.lng }}
      label={label.name}
      identifier={`${ID_PREFIX}${label.name}`}
      zIndex={0}
    >
      <Text style={styles.text} importantForAccessibility="no-hide-descendants" numberOfLines={1}>
        {label.name}
      </Text>
    </StaticMarker>
  );
});

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text,
    opacity: 0.9,
    // Subtle dark halo so the name reads over land, water and roads. The padding keeps it from being clipped.
    textShadowColor: colors.background,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
