import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { PlaceholderCard } from '@/components/placeholder-card';
import { spacing } from '@/theme';
import { tourSession } from '@/tour';

/** After a tap on "Allow notifications", the button stays inert this long so a double tap cannot ask twice. */
const ALLOW_COOLDOWN_MS = 1500;

/** Calm explanation of the lock-screen controls. The tour runs whichever way the user answers. */
export function NotificationsGate() {
  const [cooling, setCooling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const allow = () => {
    if (cooling) return;
    setCooling(true);
    timer.current = setTimeout(() => setCooling(false), ALLOW_COOLDOWN_MS);
    tourSession.requestNotifications();
  };

  return (
    <PlaceholderCard title="Lock-screen controls">
      <AppText color="textSecondary">
        A silent notification lets you pause or stop the tour with the phone locked. The tour
        runs either way.
      </AppText>
      <BigButton
        label="Allow notifications"
        variant="accent"
        disabled={cooling}
        style={styles.button}
        accessibilityHint="Shows the phone's notification permission request"
        onPress={allow}
      />
      <BigButton label="Continue without" variant="outline" onPress={() => tourSession.skipNotifications()} />
    </PlaceholderCard>
  );
}

const styles = StyleSheet.create({ button: { marginTop: spacing.sm } });
