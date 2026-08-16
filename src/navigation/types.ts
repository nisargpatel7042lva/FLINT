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

/**
 * The pre-app flow is kept flat rather than nested so every screen can call
 * `useNavigation()` without threading nested param lists through props.
 *
 * Welcome → Onboarding → SignUp/SignIn → ProfileName → ProfileGoal
 *         → FindFriends → Tabs
 */
export type RootStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ProfileName: undefined;
  ProfileGoal: undefined;
  FindFriends: undefined;
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
