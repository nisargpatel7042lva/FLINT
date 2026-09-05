import type { NavigatorScreenParams } from '@react-navigation/native';

import type { BarrierId } from '../services/onboarding';
import type { Focus } from '../services/training';

/**
 * Route params live here so screens and navigators share one source of truth.
 * Add routes to these maps before wiring them into a navigator.
 */

/**
 * Tabs are PERSONAL ONLY for this phase. The social screens (Feed, Wars,
 * Groups) still exist and remain reachable as stack routes — they are simply
 * out of the tab bar so the individual loop can be judged on its own.
 */
export type MainTabParamList = {
  Home: undefined;
  Train: undefined;
  History: undefined;
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

  // Personal tracking
  WorkoutDetail: { minutes: number; focus: Focus };
  WorkoutLog: { minutes: number; focus: Focus };

  // Social screens, kept reachable but off the tab bar this phase.
  Feed: undefined;
  Wars: undefined;
  Groups: undefined;

  // Flint MVP: 1:1 Challenges
  CreateOneOnOne: undefined;
  AcceptChallenge: { token: string };
  ChallengeDetail: { challengeId: string };
  ChallengeLog: { challengeId: string };
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
