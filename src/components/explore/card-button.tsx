import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, minTouchTarget, radius, spacing } from '@/theme';

export interface CardButtonProps {
  label: string;
  onPress: () => void;
  /** `filled` is the main action; `outline` the secondary one. */
  variant?: 'filled' | 'outline';
  accessibilityLabel?: string;
}

/** Compact button for the Explore card. Shares the row evenly with its siblings. */
export function CardButton({ label, onPress, variant = 'filled', accessibilityLabel }: CardButtonProps) {
  const filled = variant === 'filled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        filled
          ? { backgroundColor: pressed ? colors.accentPressed : colors.accent }
          : { backgroundColor: pressed ? colors.surfaceRaised : 'transparent', borderColor: colors.accent },
      ]}
    >
      <AppText variant="button" color={filled ? 'textOnAccent' : 'accent'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: minTouchTarget + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
