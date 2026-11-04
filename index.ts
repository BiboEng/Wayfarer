// App entry. Defines the Live Tour's TaskManager tasks (background location, notification
// buttons) before anything else. Android can start the JS without any screen (a notification
// button tapped after the app was closed); Expo Router only loads the root layout when it
// renders, so the tasks must be defined here or that start would find no task and drop it.
import '@/tour/background-tasks';

// Registers the app through Expo Router. Must stay last.
import 'expo-router/entry';
