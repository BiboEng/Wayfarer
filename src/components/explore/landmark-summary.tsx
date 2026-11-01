import type { Landmark } from '@shared/landmarks/landmark';
import { Image } from 'expo-image';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatDistance } from '@/components/format/format-distance';
import { TextButton } from '@/components/text-button';
import { colors, radius, spacing } from '@/theme';

import { kindLabel } from './kind-label';

export interface LandmarkSummaryProps {
  landmark: Landmark;
  /** From the tapped point to the landmark. */
  distanceMeters: number;
}

/** Thumbnail, name, kind and distance of the found landmark, with a Wikipedia link. */
export function LandmarkSummary({ landmark, distanceMeters }: LandmarkSummaryProps) {
  const { wikipedia } = landmark;
  const url = wikipedia?.url;

  return (
    <View style={styles.row}>
      {wikipedia?.thumbnailUrl ? (
        <Image
          source={{ uri: wikipedia.thumbnailUrl }}
          style={styles.thumb}
          contentFit="cover"
          accessibilityLabel={`Photo of ${landmark.name}`}
        />
      ) : null}
      <View style={styles.info}>
        <AppText variant="heading" accessibilityRole="header" numberOfLines={2}>
          {landmark.name}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {kindLabel(landmark.kind)} · {formatDistance(distanceMeters)} from where you tapped
        </AppText>
        {url ? (
          <View style={styles.link}>
            <TextButton
              label="Wikipedia"
              accessibilityLabel={`Open ${landmark.name} on Wikipedia`}
              // A failed open (no browser) is not worth interrupting anyone for.
              onPress={() => void Linking.openURL(url).catch(() => {})}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  info: { flex: 1, gap: spacing.xs },
  link: { alignSelf: 'flex-start', marginLeft: -spacing.sm, marginTop: -spacing.xs },
});
