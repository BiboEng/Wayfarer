import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme';

export interface SettingGroupProps {
  title: string;
  /** Optional short note under the controls. */
  note?: string;
  children: ReactNode;
}

/** A titled block of one setting: label, its controls, and an optional note. */
export function SettingGroup({ title, note, children }: SettingGroupProps) {
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong">{title}</AppText>
      {children}
      {note ? (
        <AppText variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: spacing.sm } });
