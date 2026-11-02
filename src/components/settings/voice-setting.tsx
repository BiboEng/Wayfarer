import { StyleSheet, View } from 'react-native';

import { StatusMessage } from '@/components/explore/status-message';
import { TextButton } from '@/components/text-button';
import { useVoices } from '@/hooks/use-voices';
import { settingsStore, useSettings } from '@/settings';
import { spacing } from '@/theme';

import { OptionGroup, type Option } from './option-group';
import { SettingGroup } from './setting-group';

const PHONE_VOICE: readonly Option<string | null>[] = [{ value: null, label: 'Phone voice' }];

export function VoiceSetting() {
  const { voice } = useSettings();
  const { state, retry } = useVoices();

  if (state.status === 'loading') {
    return (
      <SettingGroup title="Voice">
        <StatusMessage message="Loading voices…" busy tone="muted" />
      </SettingGroup>
    );
  }

  if (state.status === 'unavailable') {
    // The saved choice is left alone: it applies again once the server's voices are back.
    return (
      <SettingGroup title="Voice">
        <OptionGroup
          label="Voice"
          options={PHONE_VOICE}
          selected={null}
          onSelect={() => {}}
          layout="column"
        />
        <StatusMessage
          tone="muted"
          message="No voices from the server right now, so stories are spoken by your phone."
        />
        <View style={styles.retry}>
          <TextButton label="Try again" onPress={retry} accessibilityLabel="Load the voices again" />
        </View>
      </SettingGroup>
    );
  }

  const options: readonly Option<string | null>[] = [
    { value: null, label: 'Server default' },
    ...state.voices.map((item) => ({ value: item.id, label: item.label })),
  ];
  return (
    <SettingGroup title="Voice">
      <OptionGroup
        label="Voice"
        options={options}
        selected={voice}
        onSelect={(value) => settingsStore.set({ voice: value })}
        layout="column"
      />
    </SettingGroup>
  );
}

const styles = StyleSheet.create({ retry: { alignSelf: 'flex-start', marginLeft: -spacing.sm } });
