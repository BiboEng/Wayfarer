import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { tourSession } from '@/tour';
import type { TourSnapshot } from '@/tour/types';

import { NarratedList } from './narrated-list';
import { NowPlayingCard } from './now-playing-card';
import { TourControls } from './tour-controls';
import { TourMap } from './tour-map';

/** A running tour: map and now-playing card on top, controls, then the scrolling list. */
export function ActiveTour({ snapshot }: { snapshot: TourSnapshot }) {
  const { status, current } = snapshot;
  return (
    <View style={styles.column}>
      <TourMap
        position={snapshot.position}
        headingDeg={snapshot.headingDeg}
        nearby={snapshot.nearby}
        history={snapshot.history}
        current={current?.landmark ?? null}
        mode={snapshot.mode}
        modeFixed={snapshot.modeFixed}
      />
      <NowPlayingCard status={status} current={current} />
      <TourControls
        status={status}
        hasCurrent={current !== null}
        onPause={() => tourSession.pause()}
        onResume={() => tourSession.resume()}
        onSkip={() => tourSession.skip()}
      />
      <NarratedList history={snapshot.history} onReplay={(id) => tourSession.replay(id)} />
    </View>
  );
}

const styles = StyleSheet.create({ column: { flex: 1, minHeight: 0, gap: spacing.md } });
