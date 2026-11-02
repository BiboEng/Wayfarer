import { StyleSheet, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { spacing } from '@/theme';
import type { TourStatus } from '@/tour/types';

export interface TourControlsProps {
  status: TourStatus;
  /** true when a story is current (playing, being fetched or paused). */
  hasCurrent: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
}

/**
 * Pause/Resume and Skip, big enough to hit without looking. Skip stays in place but is inert
 * unless there is a current story (playing, being fetched or paused), so the buttons never move under a thumb.
 */
export function TourControls({ status, hasCurrent, onPause, onResume, onSkip }: TourControlsProps) {
  return (
    <View style={styles.row}>
      {status === 'paused' ? (
        <BigButton
          label="Resume"
          size="tall"
          variant="accent"
          style={styles.button}
          accessibilityLabel="Resume the tour"
          onPress={onResume}
        />
      ) : (
        <BigButton
          label="Pause"
          size="tall"
          variant="accent"
          style={styles.button}
          accessibilityLabel="Pause the tour"
          onPress={onPause}
        />
      )}
      <BigButton
        label="Skip"
        size="tall"
        variant="outline"
        disabled={!hasCurrent}
        style={styles.button}
        accessibilityLabel="Skip this story"
        onPress={onSkip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  // BigButton is full-width by default; here the two share the row.
  button: { flex: 1, width: undefined },
});
