import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CalendarDays, Dumbbell, House, User } from 'lucide-react-native';

import { DashboardScreen } from '../screens/personal/DashboardScreen';
import { TrainScreen } from '../screens/personal/TrainScreen';
import { HistoryScreen } from '../screens/personal/HistoryScreen';
import { ProfileScreen } from '../screens/personal/ProfileScreen';
import { KasratTabBar } from './KasratTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconProps = { color: string; size: number };

/**
 * Icons only — the active pill is drawn and animated by `KasratTabBar`, which
 * slides one element between tabs instead of toggling a background per item.
 */
const HomeIcon = ({ color, size }: TabIconProps) => <House color={color} size={size} />;
const TrainIcon = ({ color, size }: TabIconProps) => (
  <Dumbbell color={color} size={size} />
);
const HistoryIcon = ({ color, size }: TabIconProps) => (
  <CalendarDays color={color} size={size} />
);
const ProfileIcon = ({ color, size }: TabIconProps) => <User color={color} size={size} />;

const renderTabBar = (props: BottomTabBarProps) => <KasratTabBar {...props} />;

/**
 * PERSONAL ONLY for this phase.
 *
 * Feed / Team Wars / Groups are intentionally absent from the tab bar so the
 * individual loop stands alone. They still exist as stack routes and can be
 * re-added here in one line once the core loop is settled.
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
