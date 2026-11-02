import { settingsStore, useSettings, type TourSettings } from '@/settings';

import { OptionGroup, type Option } from './option-group';
import { SettingGroup } from './setting-group';

type TravelChoice = TourSettings['travelMode'];

const OPTIONS: readonly Option<TravelChoice>[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'walking', label: 'Walking' },
  { value: 'driving', label: 'Driving' },
];

export function TravelModeSetting() {
  const { travelMode } = useSettings();
  return (
    <SettingGroup title="Travel mode" note="Auto-detect switches between walking and driving from your speed.">
      <OptionGroup
        label="Travel mode"
        options={OPTIONS}
        selected={travelMode}
        onSelect={(value) => settingsStore.set({ travelMode: value })}
      />
    </SettingGroup>
  );
}
