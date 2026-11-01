import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { NarrationView } from '@/explore/explore-view';
import { spacing } from '@/theme';

import { CardButton } from './card-button';
import { PlaybackControls } from './playback-controls';
import { StatusMessage } from './status-message';

export interface NarrationActions {
  retry: () => void;
  pause: () => void;
  resume: () => void;
  replay: () => void;
  stop: () => void;
}

/** The story part of the card: progress, controls, or why there is no story. */
export function NarrationStatus({ narration, actions }: { narration: NarrationView; actions: NarrationActions }) {
  switch (narration.status) {
    case 'writing':
      return <StatusMessage busy message="Writing the story… this can take up to 45 seconds the first time" />;
    case 'starting':
      // Can last ~30 s (audio start timeout, then device voice), so Stop is available here too.
      return (
        <View style={styles.stack}>
          <StatusMessage busy message="Getting ready…" />
          <View style={styles.row}>
            <CardButton label="Stop" variant="outline" accessibilityLabel="Stop the story" onPress={actions.stop} />
          </View>
        </View>
      );
    case 'playing':
    case 'paused':
      return (
        <View style={styles.stack}>
          {narration.output === 'device-voice' ? (
            <AppText variant="caption" color="textSecondary">
              Device voice
            </AppText>
          ) : null}
          <PlaybackControls
            status={narration.status}
            onPause={actions.pause}
            onResume={actions.resume}
            onReplay={actions.replay}
            onStop={actions.stop}
          />
        </View>
      );
    case 'ended':
      return (
        <PlaybackControls
          status="ended"
          onPause={actions.pause}
          onResume={actions.resume}
          onReplay={actions.replay}
          onStop={actions.stop}
        />
      );
    case 'unavailable':
      return (
        <View style={styles.stack}>
          <StatusMessage tone="muted" message={narration.message} />
          {narration.retryable ? (
            <View style={styles.row}>
              <CardButton label="Retry" accessibilityLabel="Try the story again" onPress={actions.retry} />
            </View>
          ) : null}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
