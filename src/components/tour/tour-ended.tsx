import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { PlaceholderCard } from '@/components/placeholder-card';
import { spacing } from '@/theme';
import { tourSession } from '@/tour';
import type { TourSource } from '@/tour/types';

/** Shown when the tour was stopped from the notification while the app was away. */
export function TourEnded({ source }: { source: TourSource }) {
  const router = useRouter();
  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <PlaceholderCard title="Tour ended">
      <AppText color="textSecondary">The tour was stopped from the notification.</AppText>
      <BigButton label="Start again" variant="accent" style={styles.button} onPress={() => tourSession.start(source)} />
      <BigButton label="Home" variant="outline" onPress={goHome} />
    </PlaceholderCard>
  );
}

const styles = StyleSheet.create({ button: { marginTop: spacing.sm } });
