import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './app-text';

export type BigButtonVariant = 'primary' | 'accent' | 'outline';
export type BigButtonSize = 'huge' | 'tall' | 'large';

export interface BigButtonProps {
  label: string;
  onPress: () => void;
  variant?: BigButtonVariant;
  /** `huge` (160dp) and `tall` (96dp) are meant for hitting without looking, e.g. while driving. */
  size?: BigButtonSize;
  /** Dimmed and inert; keeps its place so buttons do not move around. */
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<BigButtonSize, number> = { huge: 160, tall: 96, large: 72 };

/** Full-width, high-contrast button with a big touch target. */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: BigButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.overlay }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: HEIGHT[size] },
        variantStyle(variant, pressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      <AppText
        variant={size === 'large' ? 'button' : 'bigButton'}
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
  disabled: { opacity: 0.4 },
});
