import { StyleSheet, View } from 'react-native';

import { useServerHealth, type ServerHealthState } from '@/hooks/use-server-health';
import { spacing } from '@/theme';

import { AppText } from './app-text';
import { TextButton } from './text-button';

function describe(state: ServerHealthState): string {
  switch (state.status) {
    case 'checking':
      return 'Checking…';
    case 'ok':
      return `Server: ok (v${state.version})`;
    case 'unreachable':
      return `Server unreachable — ${state.message}`;
  }
}

/** Quiet inline server health indicator with a "Check again" action. */
export function ServerStatus() {
  const { state, recheck } = useServerHealth();
  return (
    <View style={styles.row}>
      <AppText
        variant="body"
        color={state.status === 'ok' ? 'success' : 'textSecondary'}
        style={styles.text}
        accessibilityLiveRegion="polite"
      >
        {describe(state)}
      </AppText>
      <TextButton
        label="Check again"
        onPress={recheck}
        disabled={state.status === 'checking'}
        accessibilityLabel="Check server status again"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
});
