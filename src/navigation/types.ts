import type { NavigatorScreenParams } from '@react-navigation/native';

import type { BarrierId } from '../services/onboarding';

/**
 * Route params live here so screens and navigators share one source of truth.
 * Add routes to these maps before wiring them into a navigator.
 */

export type MainTabParamList = {
  Home: undefined;
  Feed: undefined;
  Wars: undefined;
  Groups: undefined;
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
  /**
   * First-60-seconds flow. Auth deliberately sits AFTER the first win:
   * Splash -> Barrier -> CharReaction -> TimeBudget -> FirstWorkout -> SignUp
   */
  Splash: undefined;
  Barrier: undefined;
  CharReaction: { barrierId: BarrierId };
  TimeBudget: undefined;
  FirstWorkout: { minutes: number } | undefined;

  Welcome: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ProfileName: undefined;
  ProfileGoal: undefined;
  FindFriends: undefined;
  Tabs: NavigatorScreenParams<MainTabParamList>;

  // Social / competitive layer
  GroupDetail: { groupId: string };
  CreateChallenge: { groupId?: string } | undefined;
  TeamWar: { warId: string };
  /** `warId` present ⇒ video proof required. */
  ProofSubmit: { warId?: string } | undefined;
  ProofReview: undefined;
  Notifications: undefined;
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
