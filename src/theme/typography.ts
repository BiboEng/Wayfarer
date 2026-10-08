import { Platform, type TextStyle } from 'react-native';

/**
 * Fonts are embedded at build time by the expo-font config plugin
 * (see the plugin entry in app.config.ts). On Android the family name is the
 * font file name; on iOS it is the PostScript name inside the file.
 */
const family = (android: string, ios: string): string => Platform.select({ ios, default: android });

export const fontFamily = {
  heading: family('PlayfairDisplay_700Bold', 'PlayfairDisplay-Bold'),
  headingSemiBold: family('PlayfairDisplay_600SemiBold', 'PlayfairDisplay-SemiBold'),
  body: family('Inter_400Regular', 'Inter-Regular'),
  bodyMedium: family('Inter_500Medium', 'Inter-Medium'),
  bodySemiBold: family('Inter_600SemiBold', 'Inter-SemiBold'),
  bodyBold: family('Inter_700Bold', 'Inter-Bold'),
} as const;

export const typography = {
  display: { fontFamily: fontFamily.heading, fontSize: 40, lineHeight: 48 },
  title: { fontFamily: fontFamily.heading, fontSize: 28, lineHeight: 36 },
  heading: { fontFamily: fontFamily.headingSemiBold, fontSize: 22, lineHeight: 30 },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: 22, lineHeight: 30 },
  bigButton: { fontFamily: fontFamily.heading, fontSize: 34, lineHeight: 42 },
  button: { fontFamily: fontFamily.bodySemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bodySemiBold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
