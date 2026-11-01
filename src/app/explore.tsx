import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ExploreCard } from '@/components/explore/explore-card';
import { ExploreMap } from '@/components/explore/explore-map';
import { useExplore } from '@/explore/use-explore';
import { colors } from '@/theme';

/** Explore the World: a full-screen map; tap anywhere to hear the nearest landmark's story. */
export default function ExploreScreen() {
  const { view, tapped, landmark, onTap, retry, pause, resume, replay, stop } = useExplore();
  const [cardHeight, setCardHeight] = useState(0);

  return (
    <View style={styles.root}>
      <ExploreMap tapped={tapped} landmark={landmark} onTap={onTap} bottomInset={cardHeight} />
      <View style={styles.cardSlot} pointerEvents="box-none">
        <ExploreCard
          view={view}
          actions={{ retry, pause, resume, replay, stop }}
          onHeightChange={setCardHeight}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  cardSlot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
