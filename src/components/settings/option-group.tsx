import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, minTouchTarget, radius, spacing } from '@/theme';

export interface Option<T> {
  value: T;
  label: string;
}

export interface OptionGroupProps<T> {
  /** Names the group for screen readers, e.g. "Narration length". */
  label: string;
  options: readonly Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** `row` shares the width evenly (2 to 3 short options); `column` lists them one per line. */
  layout?: 'row' | 'column';
}

/**
 * Single choice from a few options, as accessible buttons in the app's theme.
 * Chosen over the native @expo/ui Picker: its popup menu takes Material's colours, not ours,
 * and these options are few enough to always show at once.
 */
export function OptionGroup<T extends string | null>({
  label,
  options,
  selected,
  onSelect,
  layout = 'row',
}: OptionGroupProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={layout === 'row' ? styles.row : styles.column}
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value ?? 'default'}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.option,
              layout === 'row' && styles.optionRow,
              isSelected
                ? { backgroundColor: pressed ? colors.accentPressed : colors.accent, borderColor: colors.accent }
                : { backgroundColor: pressed ? colors.surfaceRaised : 'transparent', borderColor: colors.border },
            ]}
          >
            <AppText
              variant="bodyStrong"
              color={isSelected ? 'textOnAccent' : 'text'}
              numberOfLines={2}
              style={styles.text}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  column: { gap: spacing.sm },
  option: {
    minHeight: minTouchTarget + spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
  },
  optionRow: { flex: 1 },
  text: { textAlign: 'center' },
});
