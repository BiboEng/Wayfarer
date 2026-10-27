import { distanceMeters } from '@shared/geo/distance';
import type { LatLng } from '@shared/geo/lat-lng';
import type { Landmark } from '@shared/landmarks/landmark';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';

import { formatDistance } from './format-distance';

export interface LandmarkRowProps {
  landmark: Landmark;
  /** The queried point; the distance is measured from here. */
  origin: LatLng;
}

/** One search result. Tap to show or hide the Wikipedia extract. */
export function LandmarkRow({ landmark, origin }: LandmarkRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { wikipedia } = landmark;
  const extract = wikipedia?.extract;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={styles.card}
    >
      <View style={styles.top}>
        {wikipedia?.thumbnailUrl ? (
          <Image
            source={{ uri: wikipedia.thumbnailUrl }}
            style={styles.thumb}
            contentFit="cover"
            accessibilityLabel={`Thumbnail of ${landmark.name}`}
          />
        ) : null}
        <View style={styles.info}>
          <AppText variant="bodyStrong">{landmark.name}</AppText>
          <AppText variant="caption" color="textSecondary">
            {landmark.kind.replace(/_/g, ' ')} · {formatDistance(distanceMeters(origin, landmark.location))}
          </AppText>
          <AppText variant="caption" color={wikipedia ? 'success' : 'accent'} style={styles.badge}>
            {wikipedia ? 'Wikipedia' : 'OSM only'}
          </AppText>
        </View>
      </View>
      {expanded ? (
        <AppText variant="body" color="textSecondary">
          {extract || 'No extract available.'}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  info: { flex: 1, gap: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
});
