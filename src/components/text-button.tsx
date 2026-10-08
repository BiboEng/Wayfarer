import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, spacing } from '@/theme';

import { AppText } from './app-text';

export interface TextButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Quiet text-only button that still meets the minimum touch target. */
export function TextButton({ label, onPress, accessibilityLabel, disabled = false }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.base, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}
    >
      <AppText variant="bodyStrong" color="accent">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
