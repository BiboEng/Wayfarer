import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { spacing } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.intro}>
        <AppText variant="display">Wayfarer</AppText>
        <AppText variant="body" color="textSecondary">
          Your narrated guide to the places you pass.
        </AppText>
      </View>
      <View style={styles.actions}>
        <BigButton
          label="Start Tour"
          size="huge"
          variant="accent"
          accessibilityLabel="Start tour"
          accessibilityHint="Begins narrating landmarks as you travel"
          onPress={() => router.push('/tour')}
        />
        <BigButton
          label="Explore the World"
          variant="outline"
          accessibilityHint="Browse landmarks anywhere on the map"
          onPress={() => router.push('/explore')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  actions: { gap: spacing.lg, paddingBottom: spacing.lg },
});
