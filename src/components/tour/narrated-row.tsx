import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { kindLabel } from '@/components/explore/kind-label';
import { formatTime } from '@/components/format/format-time';
import { colors, minTouchTarget, radius, spacing } from '@/theme';
import type { NarratedPlace } from '@/tour/types';

export interface NarratedRowProps {
  place: NarratedPlace;
  onReplay: (landmarkId: string) => void;
}

/** One narrated place: thumbnail, name, kind and time. Tap to hear it again. */
export function NarratedRow({ place, onReplay }: NarratedRowProps) {
  const { landmark, narratedAt } = place;
  const thumbnail = landmark.wikipedia?.thumbnailUrl;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${landmark.name}, heard at ${formatTime(narratedAt)}`}
      accessibilityHint="Plays the story again"
      onPress={() => onReplay(landmark.id)}
      android_ripple={{ color: colors.overlay }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={styles.thumb} />
      )}
      <View style={styles.info}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {landmark.name}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {kindLabel(landmark.kind)} · {formatTime(narratedAt)}
        </AppText>
      </View>
      <AppText variant="caption" color="accent">
        Replay
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  info: { flex: 1, gap: 2 },
});
