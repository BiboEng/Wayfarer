import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useNarration } from '@/hooks/use-narration';
import { colors, radius, spacing } from '@/theme';

/** Debug action: asks the server to narrate a landmark and shows the result. No playback yet. */
export function NarratePanel({ landmarkId }: { landmarkId: string }) {
  const { state, narrate } = useNarration();
  const loading = state.status === 'loading';

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={() => narrate(landmarkId)}
        style={[styles.button, loading && styles.disabled]}
      >
        <AppText variant="bodyStrong">Narrate</AppText>
      </Pressable>
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.accent} />
          <AppText variant="caption" color="textSecondary">
            Writing the story, this can take up to 45 seconds...
          </AppText>
        </View>
      ) : null}
      {state.status === 'error' ? (
        <AppText variant="body" color="accent">
          {state.error.code === 'NOT_NARRATABLE'
            ? 'No Wikipedia text to narrate this place.'
            : state.error.message}
        </AppText>
      ) : null}
      {state.status === 'done' ? (
        <View style={styles.panel}>
          <AppText variant="body">{state.narration.text}</AppText>
          <AppText variant="caption" color="textSecondary">
            Source: {state.narration.source === 'ai' ? 'AI' : 'Wikipedia fallback'}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {state.narration.audio ? 'Audio: ready' : 'Audio: none (device voice)'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabled: { opacity: 0.5 },
});
