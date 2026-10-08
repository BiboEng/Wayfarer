import { DarkTheme, type Theme } from 'expo-router';

import { colors } from './colors';
import { fontFamily } from './typography';

/** React Navigation theme built from our tokens (dark only). */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: fontFamily.body, fontWeight: 'normal' },
    medium: { fontFamily: fontFamily.bodyMedium, fontWeight: 'normal' },
    bold: { fontFamily: fontFamily.bodyBold, fontWeight: 'normal' },
    heavy: { fontFamily: fontFamily.bodyBold, fontWeight: 'normal' },
  },
};
