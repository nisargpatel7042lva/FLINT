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
import { useSessions } from '../hooks/useSessions';
import {
  BarrierScreen,
  CharReactionScreen,
  CreateChallengeScreen,
  FindFriendsScreen,
  GroupDetailScreen,
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
   * Returning users skip onboarding.
   *
   * Having training history IS the signal that someone has been here before —
   * no separate "hasOnboarded" flag to keep in sync, and it behaves correctly
   * on a fresh install (no sessions -> onboarding) and on reinstall against an
   * existing account (sessions sync -> straight into the app).
   */
  const { logs, loading } = useSessions();

  if (loading) {
    // Brief, and on-theme — a white flash here would be the first thing anyone
    // sees on a cold start.
    return (
      <View style={[styles.boot, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const initialRouteName = logs.length > 0 ? 'Tabs' : 'Splash';

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* First 60 seconds. Account creation comes AFTER the first win. */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Barrier" component={BarrierScreen} />
        <Stack.Screen name="CharReaction" component={CharReactionScreen} />
        <Stack.Screen name="TimeBudget" component={TimeBudgetScreen} />
        <Stack.Screen name="FirstWorkout" component={FirstWorkoutScreen} />

        {/* Legacy entry, kept reachable while the new flow settles. */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="ProfileName" component={ProfileNameScreen} />
        <Stack.Screen name="ProfileGoal" component={ProfileGoalScreen} />
        <Stack.Screen name="FindFriends" component={FindFriendsScreen} />

        {/* Main app. Entered via `reset` so back does not return to setup. */}
        <Stack.Screen name="Tabs" component={TabNavigator} />

        {/* Social / competitive layer, pushed over the tabs. */}
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        <Stack.Screen name="CreateChallenge" component={CreateChallengeScreen} />
        <Stack.Screen name="TeamWar" component={TeamWarScreen} />
        <Stack.Screen name="ProofReview" component={ProofReviewScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />

        {/* Personal tracking loop. */}
        <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
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
