import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../theme';
import { useProfile } from '../hooks';
import { useSessions } from '../hooks/useSessions';
import { linkingConfig } from '../services/deeplinks';
import {
  AcceptChallengeScreen,
  AppearanceScreen,
  BarrierScreen,
  ChallengeDetailScreen,
  ChallengeLogScreen,
  SparkReactionScreen,
  CreateChallengeScreen,
  CreateOneOnOneScreen,
  BodyBasicsScreen,
  ExerciseDetailScreen,
  ExploredScreen,
  ExerciseLibraryScreen,
  FindFriendsScreen,
  FriendsScreen,
  GroupDetailScreen,
  MuscleGroupScreen,
  NotificationsScreen,
  OnboardingScreen,
  ProfileGoalScreen,
  ProfileNameScreen,
  ProofReviewScreen,
  ProofSubmitScreen,
  FirstWorkoutScreen,
  SignInScreen,
  SignUpScreen,
  SplashScreen,
  TeamWarScreen,
  TimeBudgetScreen,
  TrackingScreen,
  JoinClubScreen,
  AlertsPrimerScreen,
  FeedbackScreen,
  HistoryScreen,
  TrainScreen,
  TrainingPlaceScreen,
  TrainingPreferencesScreen,
  WorkoutDetailScreen,
  WorkoutLogScreen,
  FeedScreen,
  GroupsScreen,
  WelcomeScreen,
} from '../screens';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Bridges our design tokens into React Navigation's own theme object. */
function useNavigationTheme(): NavTheme {
  const theme = useTheme();
  const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: theme.mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };
}

export function RootNavigator() {
  const navTheme = useNavigationTheme();
  const theme = useTheme();

  /**
   * Returning users skip the opening.
   *
   * Two independent signals, either of which is enough:
   *
   *  - Training history. Correct on a reinstall against an existing account —
   *    the sessions sync and the person lands straight in the app.
   *  - `profile.completed`, written the moment the first session is finished.
   *
   * The flag is not redundant. Somebody can finish the opening while offline,
   * or decline the account and later clear their history, and without it the
   * app greets them as a stranger and replays the whole introduction — having
   * already been told, once, what stops them from training.
   */
  const { logs, loading } = useSessions();
  const { profile, loading: profileLoading } = useProfile();

  if (loading || profileLoading) {
    // Brief, and on-theme — a white flash here would be the first thing anyone
    // sees on a cold start.
    return (
      <View style={[styles.boot, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const initialRouteName = logs.length > 0 || profile.completed ? 'Tabs' : 'Splash';

  return (
    <NavigationContainer theme={navTheme} linking={linkingConfig}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* First 60 seconds. Account creation comes AFTER the first win. */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Barrier" component={BarrierScreen} />
        <Stack.Screen name="SparkReaction" component={SparkReactionScreen} />
        <Stack.Screen name="TrainingPlace" component={TrainingPlaceScreen} />
        <Stack.Screen name="TimeBudget" component={TimeBudgetScreen} />
        <Stack.Screen name="FirstWorkout" component={FirstWorkoutScreen} />

        {/* Legacy entry, kept reachable while the new flow settles. */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="ProfileName" component={ProfileNameScreen} />
        <Stack.Screen name="BodyBasics" component={BodyBasicsScreen} />
        <Stack.Screen name="ProfileGoal" component={ProfileGoalScreen} />
        <Stack.Screen name="FindFriends" component={FindFriendsScreen} />
        <Stack.Screen name="JoinClub" component={JoinClubScreen} />
        <Stack.Screen name="AlertsPrimer" component={AlertsPrimerScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />

        {/* Main app. Entered via `reset` so back does not return to setup. */}
        <Stack.Screen name="Tabs" component={TabNavigator} />

        {/* Social / competitive layer, pushed over the tabs. */}
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        <Stack.Screen name="CreateChallenge" component={CreateChallengeScreen} />
        <Stack.Screen name="TeamWar" component={TeamWarScreen} />
        <Stack.Screen name="ProofReview" component={ProofReviewScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} />
        <Stack.Screen
          name="TrainingPreferences"
          component={TrainingPreferencesScreen}
        />
        <Stack.Screen name="Friends" component={FriendsScreen} />

        {/* Flint MVP: 1:1 Challenges */}
        <Stack.Screen name="CreateOneOnOne" component={CreateOneOnOneScreen} />
        <Stack.Screen name="AcceptChallenge" component={AcceptChallengeScreen} />
        <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
        <Stack.Screen
          name="ChallengeLog"
          component={ChallengeLogScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />

        {/* Personal tracking loop. */}
        <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
        <Stack.Screen name="Tracking" component={TrackingScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Train" component={TrainScreen} />
        <Stack.Screen name="Explored" component={ExploredScreen} />

        {/* Exercise library — 873 movements, bundled and offline. */}
        <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
        <Stack.Screen name="MuscleGroup" component={MuscleGroupScreen} />
        <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
        <Stack.Screen
          name="WorkoutLog"
          component={WorkoutLogScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />

        {/* Social screens: off the tab bar this phase, still routable. */}
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Wars" component={TeamWarScreen} />
        <Stack.Screen name="Groups" component={GroupsScreen} />
        <Stack.Screen
          name="ProofSubmit"
          component={ProofSubmitScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
