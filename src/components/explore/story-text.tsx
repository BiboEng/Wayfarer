import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { TextButton } from '@/components/text-button';
import { colors, radius, spacing } from '@/theme';

/** The story takes at most this share of the screen height, so the map stays visible. */
const MAX_HEIGHT_SHARE = 0.25;

/** Collapsible, scrollable "Read the story" section. */
export function StoryText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();

  return (
    <View>
      <View style={styles.toggle}>
        <TextButton
          label={open ? 'Hide the story' : 'Read the story'}
          accessibilityLabel={open ? 'Hide the story text' : 'Read the story text'}
          onPress={() => setOpen((value) => !value)}
        />
      </View>
      {open ? (
        <ScrollView
          style={[styles.scroll, { maxHeight: height * MAX_HEIGHT_SHARE }]}
          nestedScrollEnabled
          accessibilityLabel="Story text"
        >
          <AppText color="textSecondary">{text}</AppText>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
  scroll: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
