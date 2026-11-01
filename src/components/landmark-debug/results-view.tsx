import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatDistance } from '@/components/format/format-distance';
import type { LandmarkSearchState } from '@/hooks/use-landmark-search';
import { colors, spacing } from '@/theme';

import { LandmarkRow } from './landmark-row';

/** Shows the idle hint, spinner, error, empty state or the result rows. */
export function ResultsView({ state }: { state: LandmarkSearchState }) {
  switch (state.status) {
    case 'idle':
      return (
        <AppText variant="caption" color="textSecondary">
          Pick a place and search to see what is notable there.
        </AppText>
      );
    case 'loading':
      return <ActivityIndicator color={colors.accent} accessibilityLabel="Searching" />;
    case 'error':
      return (
        <AppText color="danger" accessibilityLiveRegion="polite">
          {state.error.message}
        </AppText>
      );
    case 'done':
      return (
        <View style={styles.list}>
          {state.searchedRadiusMeters !== undefined ? (
            <AppText variant="caption" color="textSecondary">
              Searched up to {formatDistance(state.searchedRadiusMeters)}
            </AppText>
          ) : null}
          {state.landmarks.length === 0 ? (
            <AppText color="textSecondary">Nothing notable here</AppText>
          ) : (
            state.landmarks.map((landmark) => (
              <LandmarkRow key={landmark.id} landmark={landmark} origin={state.origin} />
            ))
          )}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
