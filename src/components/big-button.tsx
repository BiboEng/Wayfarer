import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './app-text';

export type BigButtonVariant = 'primary' | 'accent' | 'outline';
export type BigButtonSize = 'huge' | 'large';

export interface BigButtonProps {
  label: string;
  onPress: () => void;
  variant?: BigButtonVariant;
  /** `huge` (160dp) is meant for hitting without looking, e.g. while driving. */
  size?: BigButtonSize;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<BigButtonSize, number> = { huge: 160, large: 72 };

/** Full-width, high-contrast button with a big touch target. */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  accessibilityLabel,
  accessibilityHint,
  style,
}: BigButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      android_ripple={{ color: colors.overlay }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: HEIGHT[size] },
        variantStyle(variant, pressed),
        style,
      ]}
    >
      <AppText
        variant={size === 'huge' ? 'bigButton' : 'button'}
        color={variant === 'accent' ? 'textOnAccent' : 'text'}
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function variantStyle(variant: BigButtonVariant, pressed: boolean): ViewStyle {
  switch (variant) {
    case 'accent':
      return { backgroundColor: pressed ? colors.accentPressed : colors.accent };
    case 'outline':
      return {
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        borderWidth: 2,
        borderColor: colors.accent,
      };
    case 'primary':
      return { backgroundColor: pressed ? colors.primaryPressed : colors.primary };
  }
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  label: { textAlign: 'center' },
});
