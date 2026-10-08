import type { ConfigContext, ExpoConfig } from 'expo/config';

// The Maps key comes from the environment (EAS env var for cloud builds, a
// git-ignored .env file locally). It must never be written into this file.
// When it is missing the app still runs; the map just stays blank.
const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wayfarer',
  slug: 'wayfarer',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'wayfarer',
  userInterfaceStyle: 'dark',
  ios: {
    icon: './assets/expo.icon',
  },
  android: {
    package: 'com.biboeng.wayfarer',
    adaptiveIcon: {
      backgroundColor: '#2A1410',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2A1410',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-audio',
    [
      // Embeds fonts at build time; on Android the family name is the file name.
      'expo-font',
      {
        fonts: [
          'node_modules/@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf',
          'node_modules/@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf',
          'node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',
          'node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf',
          'node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf',
          'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
        ],
      },
    ],
    ['react-native-maps', { androidGoogleMapsApiKey: googleMapsAndroidApiKey }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  // After `eas init`, paste the project id here:
  // extra: { eas: { projectId: '<your-project-id>' } },
});
