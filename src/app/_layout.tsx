import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SettingsHeaderButton } from '@/components/settings-header-button';
import { colors, navigationTheme, typography } from '@/theme';

// Fonts are embedded at build time (expo-font config plugin), so there is
// nothing to wait for: the splash screen auto-hides once the first screen renders.
export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { ...typography.headerTitle, color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Wayfarer', headerRight: () => <SettingsHeaderButton /> }}
        />
        <Stack.Screen name="tour" options={{ title: 'Live Tour' }} />
        <Stack.Screen name="explore" options={{ title: 'Explore the World' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="debug/landmarks" options={{ title: 'Landmark debug' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
