import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { SourcePicker } from '@/components/tour/source-picker';
import { TourBody } from '@/components/tour/tour-body';
import { useConditionalKeepAwake } from '@/hooks/use-conditional-keep-awake';
import { useTourLifecycle } from '@/hooks/use-tour-lifecycle';
import { spacing } from '@/theme';
import { tourSession, useTourSession } from '@/tour';

export default function TourScreen() {
  const router = useRouter();
  const snapshot = useTourSession();
  const { changeSource } = useTourLifecycle();
  // Only when tracking pauses with the screen off (null = not known yet: leave the screen alone).
  const pausesOffScreen = snapshot.runsInBackground === false;
  useConditionalKeepAwake(pausesOffScreen);

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
      {pausesOffScreen && snapshot.source === 'gps' ? (
        <AppText variant="caption" color="textSecondary" style={styles.note}>
          The tour pauses when the screen turns off on this phone.
        </AppText>
      ) : null}
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
  note: { textAlign: 'center' },
});
