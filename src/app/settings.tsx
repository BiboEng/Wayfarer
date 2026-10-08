import { AppText } from '@/components/app-text';
import { PlaceholderCard } from '@/components/placeholder-card';
import { Screen } from '@/components/screen';
import { ServerStatus } from '@/components/server-status';
import { SettingRow } from '@/components/setting-row';

export default function SettingsScreen() {
  return (
    <Screen scroll>
      <PlaceholderCard title="Narration" badge="Coming in Phase 5">
        <SettingRow label="Voice" value="Device default" />
        <SettingRow label="Narration length" value="Short · Medium · Long" />
        <SettingRow label="Travel mode" value="Walking · Driving · Auto" />
      </PlaceholderCard>
      <PlaceholderCard title="Server">
        <ServerStatus />
        <AppText variant="caption" color="textSecondary">
          Wayfarer fetches landmark stories from its own server.
        </AppText>
      </PlaceholderCard>
    </Screen>
  );
}
