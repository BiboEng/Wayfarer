import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { kindLabel } from '@/components/explore/kind-label';
import { StatusMessage } from '@/components/explore/status-message';
import { StoryText } from '@/components/explore/story-text';
import { colors, radius, spacing } from '@/theme';
import type { CurrentNarration, TourStatus } from '@/tour/types';

import { sideLabel } from './side-label';

export interface NowPlayingCardProps {
  status: TourStatus;
  current: CurrentNarration | null;
}

const STATUS_LINE: Partial<Record<TourStatus, string>> = {
  preparing: 'Getting the story…',
  narrating: 'Now playing',
  paused: 'Paused',
};

/**
 * What is playing now. When nothing is, it says the tour is listening: it never shows
 * placeholder content.
 */
export function NowPlayingCard({ status, current }: NowPlayingCardProps) {
  const statusLine = STATUS_LINE[status];
  const active = current !== null && statusLine !== undefined;

  return (
    <View style={styles.card}>
      {active ? (
        <>
          <View style={styles.row}>
            {current.landmark.wikipedia?.thumbnailUrl ? (
              <Image
                source={{ uri: current.landmark.wikipedia.thumbnailUrl }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityLabel={`Photo of ${current.landmark.name}`}
              />
            ) : null}
            <View style={styles.info} accessibilityLiveRegion="polite">
              <AppText variant="heading" numberOfLines={2} accessibilityRole="header">
                {current.landmark.name}
              </AppText>
              {current.side ? (
                <AppText variant="bodyStrong" color="accent">
                  {sideLabel(current.side)}
                </AppText>
              ) : null}
              <AppText variant="caption" color="textSecondary">
                {kindLabel(current.landmark.kind)} · {statusLine}
              </AppText>
            </View>
          </View>
          {current.text ? <StoryText text={current.text} /> : null}
        </>
      ) : (
        <StatusMessage busy tone="muted" message="Listening for nearby places…" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  info: { flex: 1, gap: spacing.xs },
});
