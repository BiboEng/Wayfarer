import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { PlaceholderCard } from '@/components/placeholder-card';
import { Screen } from '@/components/screen';
import { ServerStatus } from '@/components/server-status';
import { NarrationCard } from '@/components/settings/narration-card';
import { minTouchTarget } from '@/theme';

export default function SettingsScreen() {
  return (
    <Screen scroll>
      <NarrationCard />
      <PlaceholderCard title="Server">
        <ServerStatus />
        <AppText variant="caption" color="textSecondary">
          Wayfarer fetches landmark stories from its own server.
        </AppText>
      </PlaceholderCard>
      {__DEV__ ? (
        <PlaceholderCard title="Developer" badge="Dev builds only">
          <Link href={DEBUG_LANDMARKS_HREF} asChild>
            <Pressable accessibilityRole="link" style={styles.link}>
              <AppText variant="bodyStrong" color="accent">
                Landmark debug
              </AppText>
            </Pressable>
          </Link>
        </PlaceholderCard>
      ) : null}
    </Screen>
  );
}

const DEBUG_LANDMARKS_HREF: Href = '/debug/landmarks';

const styles = StyleSheet.create({
  link: { minHeight: minTouchTarget, justifyContent: 'center' },
});
