import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, minTouchTarget, radius, spacing } from '@/theme';

export interface ChipProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
}

/** Small pill used for radius choices and preset shortcuts. */
export function Chip({ label, onPress, selected = false }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <AppText variant="bodyStrong" color={selected ? 'textOnAccent' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
