import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { SourcePicker } from '@/components/tour/source-picker';
import { TourBody } from '@/components/tour/tour-body';
import { useTourLifecycle } from '@/hooks/use-tour-lifecycle';
import { spacing } from '@/theme';
import { tourSession, useTourSession } from '@/tour';

export default function TourScreen() {
  // The tour only works on screen, so the screen must not go to sleep while it runs.
  useKeepAwake();
  const router = useRouter();
  const snapshot = useTourSession();
  const { changeSource } = useTourLifecycle();

  const stopTour = () => {
    tourSession.stop();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen>
      <View style={styles.body}>
        <TourBody snapshot={snapshot} />
      </View>
      {__DEV__ ? <SourcePicker source={snapshot.source} onChange={changeSource} /> : null}
      <BigButton
        label="Stop Tour"
        variant="primary"
        accessibilityLabel="Stop tour"
        accessibilityHint="Ends the tour and returns to the home screen"
        onPress={stopTour}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, gap: spacing.lg },
});
