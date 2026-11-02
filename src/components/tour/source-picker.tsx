import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { OptionGroup, type Option } from '@/components/settings/option-group';
import { spacing } from '@/theme';
import type { TourSource } from '@/tour/types';

const OPTIONS: readonly Option<TourSource>[] = [
  { value: 'gps', label: 'Real GPS' },
  { value: 'sim-walk', label: 'Walk route' },
  { value: 'sim-drive', label: 'Drive route' },
];

export interface SourcePickerProps {
  source: TourSource;
  onChange: (source: TourSource) => void;
}

/** Development only: where the tour's positions come from. */
export function SourcePicker({ source, onChange }: SourcePickerProps) {
  return (
    <View style={styles.box}>
      <AppText variant="caption" color="textSecondary">
        Dev: position source
      </AppText>
      <OptionGroup label="Position source" options={OPTIONS} selected={source} onSelect={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.xs } });
