import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './app-text';

export interface SettingRowProps {
  label: string;
  /** Current or available values, shown as secondary text. */
  value: string;
}

/** Read-only settings row (controls arrive in Phase 5). */
export function SettingRow({ label, value }: SettingRowProps) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}. Coming soon.`}>
      <AppText variant="bodyStrong">{label}</AppText>
      <AppText variant="caption" color="textSecondary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 64,
    justifyContent: 'center',
  },
});
