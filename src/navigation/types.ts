import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Route params live here so screens and navigators share one source of truth.
 * Add routes to these maps before wiring them into a navigator.
 */

export type MainTabParamList = {
  Home: undefined;
  Activity: undefined;
  Workouts: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
};

/**
 * Makes `navigation.navigate(...)` type-safe app-wide without importing the
 * param list at every call site.
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
