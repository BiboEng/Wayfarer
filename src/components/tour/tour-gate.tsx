import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { PlaceholderCard } from '@/components/placeholder-card';
import { spacing } from '@/theme';
import { tourSession } from '@/tour';
import type { TourSource } from '@/tour/types';

export type GateStatus = 'needs-permission' | 'permission-denied' | 'location-off' | 'location-approximate';

/** After a tap on "Allow location", the button stays inert this long so a double tap cannot ask twice. */
const ALLOW_COOLDOWN_MS = 1500;

// A failed open is not worth interrupting anyone for.
const openSettings = () => void Linking.openSettings().catch(() => {});

/** Calm, on-screen explanation for a tour that cannot track yet. Never a popup. */
export function TourGate({ status, source }: { status: GateStatus; source: TourSource }) {
  const [cooling, setCooling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const allow = () => {
    if (cooling) return;
    setCooling(true);
    timer.current = setTimeout(() => setCooling(false), ALLOW_COOLDOWN_MS);
    tourSession.requestPermission();
  };
  const tryAgain = () => tourSession.start(source);

  switch (status) {
    case 'needs-permission':
      return (
        <PlaceholderCard title="Allow location">
          <AppText color="textSecondary">
            Wayfarer needs your location to find landmarks around you as you move. It is used only
            while a tour is running, and your position is not stored on our server.
          </AppText>
          <BigButton
            label="Allow location"
            variant="accent"
            disabled={cooling}
            style={styles.button}
            accessibilityHint="Shows the phone's location permission request"
            onPress={allow}
          />
        </PlaceholderCard>
      );
    case 'permission-denied':
      return (
        <PlaceholderCard title="Location is off for Wayfarer">
          <AppText color="textSecondary">
            Without your location the tour cannot find places near you. You can allow it in your
            phone settings; the tour continues when you come back.
          </AppText>
          <BigButton label="Open settings" variant="accent" style={styles.button} onPress={openSettings} />
        </PlaceholderCard>
      );
    case 'location-approximate':
      return (
        <PlaceholderCard title="Precise location needed">
          <AppText color="textSecondary">
            Wayfarer needs precise location to tell which side places are on and to find what is
            close. Turn on &quot;Use precise location&quot; for Wayfarer in the phone settings.
          </AppText>
          <BigButton label="Open settings" variant="accent" style={styles.button} onPress={openSettings} />
          <BigButton label="Try again" variant="outline" onPress={tryAgain} />
        </PlaceholderCard>
      );
    case 'location-off':
      return (
        <PlaceholderCard title="Turn on location">
          <AppText color="textSecondary">
            Location is switched off on this phone. Turn it on in the quick settings or the
            phone settings, then try again.
          </AppText>
          <BigButton label="Try again" variant="accent" style={styles.button} onPress={tryAgain} />
        </PlaceholderCard>
      );
  }
}

const styles = StyleSheet.create({ button: { marginTop: spacing.sm } });
