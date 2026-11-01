import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { CardButton } from './card-button';

export interface PlaybackControlsProps {
  status: 'playing' | 'paused' | 'ended';
  onPause: () => void;
  onResume: () => void;
  onReplay: () => void;
  onStop: () => void;
}

/** Pause/Resume and Stop while a story is active; Replay once it has ended. */
export function PlaybackControls({ status, onPause, onResume, onReplay, onStop }: PlaybackControlsProps) {
  if (status === 'ended') {
    return (
      <View style={styles.row}>
        <CardButton label="Replay" accessibilityLabel="Replay the story" onPress={onReplay} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {status === 'playing' ? (
        <CardButton label="Pause" accessibilityLabel="Pause the story" onPress={onPause} />
      ) : (
        <CardButton label="Resume" accessibilityLabel="Resume the story" onPress={onResume} />
      )}
      <CardButton label="Stop" variant="outline" accessibilityLabel="Stop the story" onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
});
