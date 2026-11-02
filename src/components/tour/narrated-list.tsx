import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';
import type { NarratedPlace } from '@/tour/types';

import { NarratedRow } from './narrated-row';

export interface NarratedListProps {
  /** Newest first. */
  history: readonly NarratedPlace[];
  onReplay: (landmarkId: string) => void;
}

/** Places heard so far, scrolling inside its own panel so the map and card above stay put. */
export function NarratedList({ history, onReplay }: NarratedListProps) {
  return (
    <View style={styles.panel}>
      <AppText variant="bodyStrong" accessibilityRole="header" style={styles.title}>
        Places so far
      </AppText>
      {history.length === 0 ? (
        <AppText color="textSecondary" style={styles.empty}>
          Places you hear about will appear here.
        </AppText>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(place) => `${place.landmark.id}:${place.narratedAt}`}
          renderItem={({ item }) => <NarratedRow place={item} onReplay={onReplay} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex + minHeight 0 lets the panel shrink instead of pushing the buttons off screen.
  panel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  title: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  empty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
