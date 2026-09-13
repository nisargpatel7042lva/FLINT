import type { NavigatorScreenParams } from '@react-navigation/native';

import type { BarrierId } from '../services/onboarding';
import type { BodyRegion, Muscle } from '../services/exercises';
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
  /**
   * `justOnboarded` is set by the last screen of the opening flow.
   *
   * It exists so the home walkthrough does not start in the same breath as the
   * introduction that just finished. Two tutorials back to back read as one
   * long tutorial, and the second one teaches a streak card that the first one
   * already explained.
   */
  Home: { justOnboarded?: boolean } | undefined;
  Train: undefined;
  Squad: undefined;
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
   * Splash -> Barrier -> SparkReaction -> TrainingPlace -> TimeBudget
   *        -> FirstWorkout -> SignUp
   */
  Splash: undefined;
  Barrier: undefined;
  SparkReaction: { barrierId: BarrierId };
  TrainingPlace: undefined;
  TimeBudget: undefined;
  FirstWorkout: { minutes: number } | undefined;

  Welcome: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ProfileName: undefined;
  /**
   * `inSetup` distinguishes the onboarding step from the same screen reached
   * later from Settings — it decides whether there are progress dots and
   * where Continue goes.
   */
  BodyBasics: { inSetup?: boolean } | undefined;
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
  Appearance: undefined;
  TrainingPreferences: undefined;
  Explored: undefined;
  Friends: undefined;

  // Personal tracking
  /**
   * `region` + `exerciseIds` are set when the session came from the exercise
   * library. Both screens rebuild the identical plan from these params via
   * `resolvePlan`, and carrying the ids means neither has to re-derive a
   * selection from the user's profile and hope they agree.
   */
  WorkoutDetail: {
    minutes: number;
    focus: Focus;
    region?: BodyRegion;
    exerciseIds?: string[];
  };
  WorkoutLog: {
    minutes: number;
    focus: Focus;
    region?: BodyRegion;
    exerciseIds?: string[];
  };

  // Exercise library
  ExerciseLibrary: undefined;
  MuscleGroup: { region: BodyRegion; muscle?: Muscle };
  ExerciseDetail: { id: string };
  /** Live GPS session. Defaults to a run when no kind is given. */
  Tracking: { kind: 'run' | 'walk' } | undefined;

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
