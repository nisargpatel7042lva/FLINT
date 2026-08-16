import React from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../theme';
import {
  FindFriendsScreen,
  OnboardingScreen,
  ProfileGoalScreen,
  ProfileNameScreen,
  SignInScreen,
  SignUpScreen,
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

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* Pre-app flow. Auth is not wired yet, so these are linear. */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="ProfileName" component={ProfileNameScreen} />
        <Stack.Screen name="ProfileGoal" component={ProfileGoalScreen} />
        <Stack.Screen name="FindFriends" component={FindFriendsScreen} />

        {/* Main app. Entered via `reset` so back does not return to setup. */}
        <Stack.Screen name="Tabs" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
