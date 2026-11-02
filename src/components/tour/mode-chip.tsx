import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, radius, spacing } from '@/theme';

export interface ModeChipProps {
  mode: 'walking' | 'driving';
  /** true when Settings fixes the mode; false when it is detected from speed. */
  fixed: boolean;
}

/** Small pill: "Walking" / "Driving", with "(auto)" when it is detected rather than chosen. */
export function ModeChip({ mode, fixed }: ModeChipProps) {
  const name = mode === 'walking' ? 'Walking' : 'Driving';
  const label = fixed ? name : `${name} (auto)`;
  return (
    <View style={styles.chip} accessible accessibilityLabel={`Travel mode: ${label}`}>
      <AppText variant="caption" color="text">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.overlay,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
