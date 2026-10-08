import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './app-text';

export interface PlaceholderCardProps {
  title: string;
  /** Short note, e.g. "Arrives in Phase 5". */
  badge?: string;
  children?: ReactNode;
}

/** Surface card used for features that are not built yet. */
export function PlaceholderCard({ title, badge, children }: PlaceholderCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
        {badge ? (
          <AppText variant="caption" color="accent" style={styles.badge}>
            {badge}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  badge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
