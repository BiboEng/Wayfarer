import type { NarrationLength } from '@shared/narration/options';

import { settingsStore, useSettings } from '@/settings';

import { OptionGroup, type Option } from './option-group';
import { SettingGroup } from './setting-group';

const OPTIONS: readonly Option<NarrationLength>[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export function LengthSetting() {
  const { length } = useSettings();
  return (
    <SettingGroup title="Narration length" note="How much is said about each place.">
      <OptionGroup
        label="Narration length"
        options={OPTIONS}
        selected={length}
        onSelect={(value) => settingsStore.set({ length: value })}
      />
    </SettingGroup>
  );
}
