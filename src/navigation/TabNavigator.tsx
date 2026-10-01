import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CalendarDays, Dumbbell, House, User, Users } from 'lucide-react-native';

import { DashboardScreen } from '../screens/personal/DashboardScreen';
import { TrainScreen } from '../screens/personal/TrainScreen';
import { HistoryScreen } from '../screens/personal/HistoryScreen';
import { ProfileScreen } from '../screens/personal/ProfileScreen';
import { GroupsScreen } from '../screens/social/GroupsScreen';
import { FlintTabBar } from './FlintTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconProps = { color: string; size: number };

/**
 * Icons only — the active pill is drawn and animated by `FlintTabBar`, which
 * slides one element between tabs instead of toggling a background per item.
 */
const HomeIcon = ({ color, size }: TabIconProps) => <House color={color} size={size} />;
const TrainIcon = ({ color, size }: TabIconProps) => (
  <Dumbbell color={color} size={size} />
);
const HistoryIcon = ({ color, size }: TabIconProps) => (
  <CalendarDays color={color} size={size} />
);
const SquadIcon = ({ color, size }: TabIconProps) => <Users color={color} size={size} />;
const ProfileIcon = ({ color, size }: TabIconProps) => <User color={color} size={size} />;

const renderTabBar = (props: BottomTabBarProps) => <FlintTabBar {...props} />;

/**
 * Personal loop plus the social layer.
 *
 * Groups came back onto the bar once they became real — creatable, joinable
 * and persisted. A feature reachable only by deep link is a feature nobody
 * uses. Feed and Team Wars stay off the bar and remain stack routes, opened
 * from inside a group where they have context.
 */
export function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}>
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarAccessibilityLabel: 'Home', tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="Train"
        component={TrainScreen}
        options={{ tabBarAccessibilityLabel: 'Train', tabBarIcon: TrainIcon }}
      />
      <Tab.Screen
        name="Squad"
        component={GroupsScreen}
        options={{ tabBarAccessibilityLabel: 'Clubs', tabBarIcon: SquadIcon }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarAccessibilityLabel: 'History', tabBarIcon: HistoryIcon }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarAccessibilityLabel: 'Profile', tabBarIcon: ProfileIcon }}
      />
    </Tab.Navigator>
  );
}
