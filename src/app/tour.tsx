import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { PlaceholderCard } from '@/components/placeholder-card';
import { Screen } from '@/components/screen';
import { spacing } from '@/theme';

export default function TourScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.body}>
        <PlaceholderCard title="Live Tour" badge="Arrives in Phase 5">
          <AppText color="textSecondary">
            This screen will show what is playing now, a small map with your position, and the list
            of places narrated so far.
          </AppText>
        </PlaceholderCard>
      </View>
      <BigButton
        label="Stop Tour"
        size="huge"
        variant="primary"
        accessibilityLabel="Stop tour"
        accessibilityHint="Ends the tour and returns to the home screen"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.lg },
});
