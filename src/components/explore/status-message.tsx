import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/theme';

export interface StatusMessageProps {
  message: string;
  /** Show a spinner before the message. */
  busy?: boolean;
  /** Message colour; errors use `danger`. */
  tone?: 'normal' | 'muted' | 'error';
}

/** One line of status text, optionally with a spinner. Announced politely to screen readers. */
export function StatusMessage({ message, busy = false, tone = 'normal' }: StatusMessageProps) {
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      {busy ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" /> : null}
      <AppText
        style={styles.text}
        color={tone === 'error' ? 'danger' : tone === 'muted' ? 'textSecondary' : 'text'}
      >
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
});
