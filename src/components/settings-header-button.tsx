import { useRouter } from 'expo-router';

import { TextButton } from './text-button';

/** Header-right button on Home that opens Settings. */
export function SettingsHeaderButton() {
  const router = useRouter();
  return (
    <TextButton
      label="Settings"
      accessibilityLabel="Open settings"
      onPress={() => router.push('/settings')}
    />
  );
}
