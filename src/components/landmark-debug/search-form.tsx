import type { LatLng } from '@shared/geo/lat-lng';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { colors, minTouchTarget, radius, spacing, typography } from '@/theme';

import { Chip } from './chip';
import { parseCoordinates } from './parse-coordinates';
import { COORDINATE_PRESETS, DEFAULT_RADIUS_M, RADIUS_OPTIONS_M } from './presets';

export interface SearchFormProps {
  onNearby: (origin: LatLng, radiusMeters: number) => void;
  onNearest: (origin: LatLng) => void;
}

/** Coordinates field, radius chips, presets and the two search buttons. */
export function SearchForm({ onNearby, onNearest }: SearchFormProps) {
  const [text, setText] = useState<string>(COORDINATE_PRESETS[0].value);
  const [radiusMeters, setRadiusMeters] = useState<number>(DEFAULT_RADIUS_M);
  const [invalid, setInvalid] = useState(false);

  const submit = (run: (origin: LatLng) => void) => {
    const origin = parseCoordinates(text);
    setInvalid(origin === null);
    if (origin) run(origin);
  };

  return (
    <View style={styles.form}>
      <AppText variant="caption" color="textSecondary">
        Coordinates (latitude, longitude)
      </AppText>
      <TextInput
        value={text}
        onChangeText={(value) => {
          setText(value);
          setInvalid(false);
        }}
        placeholder="41.0086, 28.9802"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Coordinates"
        style={[styles.input, invalid && styles.inputInvalid]}
      />
      {invalid ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          Enter latitude (-90 to 90) and longitude (-180 to 180), e.g. 41.0086, 28.9802.
        </AppText>
      ) : null}

      <View style={styles.wrap}>
        {COORDINATE_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            label={preset.label}
            onPress={() => {
              setText(preset.value);
              setInvalid(false);
            }}
          />
        ))}
      </View>

      <AppText variant="caption" color="textSecondary">
        Radius for Nearby
      </AppText>
      <View style={styles.wrap}>
        {RADIUS_OPTIONS_M.map((meters) => (
          <Chip
            key={meters}
            label={`${meters} m`}
            selected={meters === radiusMeters}
            onPress={() => setRadiusMeters(meters)}
          />
        ))}
      </View>

      <BigButton
        label="Nearby"
        variant="accent"
        onPress={() => submit((origin) => onNearby(origin, radiusMeters))}
      />
      <BigButton label="Nearest (widening)" variant="outline" onPress={() => submit(onNearest)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    ...typography.body,
    minHeight: minTouchTarget,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  inputInvalid: { borderColor: colors.danger },
});
