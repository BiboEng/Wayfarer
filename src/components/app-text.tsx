import { Text, type TextProps } from 'react-native';

import { colors, typography, type ColorToken, type TypographyToken } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyToken;
  color?: ColorToken;
}

/** Themed text: pick a typography variant and a palette color. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
