import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import type { ExploreView } from '@/explore/explore-view';
import { colors, radius, spacing } from '@/theme';

import { CardButton } from './card-button';
import { LandmarkSummary } from './landmark-summary';
import { NarrationStatus, type NarrationActions } from './narration-status';
import { storyText } from './narration-story';
import { StatusMessage } from './status-message';
import { StoryText } from './story-text';

export interface ExploreCardProps {
  view: ExploreView;
  actions: NarrationActions;
  /** Reports the card's full height (including the safe-area padding) so the map can frame its pin above it. */
  onHeightChange: (height: number) => void;
}

/** Bottom card of the Explore screen. Renders every `ExploreView` case; never opens a popup. */
export function ExploreCard({ view, actions, onHeightChange }: ExploreCardProps) {
  const insets = useSafeAreaInsets();
  const handleLayout = (event: LayoutChangeEvent) => onHeightChange(event.nativeEvent.layout.height);

  return (
    <View
      style={[styles.card, { paddingBottom: spacing.lg + insets.bottom }]}
      onLayout={handleLayout}
      accessibilityLabel="Landmark details"
    >
      <CardBody view={view} actions={actions} />
    </View>
  );
}

function CardBody({ view, actions }: { view: ExploreView; actions: NarrationActions }) {
  switch (view.kind) {
    case 'hint':
      return (
        <AppText color="textSecondary">Tap anywhere on the map to hear the story of the nearest landmark.</AppText>
      );
    case 'searching':
      return <StatusMessage busy message="Looking for landmarks near here…" />;
    case 'nothing':
      return <AppText color="textSecondary">Nothing notable within {view.radiusKm} km of this spot.</AppText>;
    case 'error':
      return (
        <View style={styles.stack}>
          <StatusMessage tone="error" message={view.message} />
          <View style={styles.row}>
            <CardButton label="Retry" accessibilityLabel="Search again" onPress={actions.retry} />
          </View>
        </View>
      );
    case 'landmark': {
      const text = storyText(view.narration);
      return (
        <View style={styles.stack}>
          <LandmarkSummary landmark={view.landmark} distanceMeters={view.distanceMeters} />
          <NarrationStatus narration={view.narration} actions={actions} />
          {text ? <StoryText key={view.landmark.id} text={text} /> : null}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  stack: { gap: spacing.md },
  row: { flexDirection: 'row' },
});
