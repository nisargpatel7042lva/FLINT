import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { House, Map, Play, User, Users } from 'lucide-react-native';

import { RunHomeScreen } from '../screens/home/RunHomeScreen';
import { CityScreen } from '../screens/city/CityScreen';
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
const CityIcon = ({ color, size }: TabIconProps) => <Map color={color} size={size} />;
/**
 * White, not accent: the accent pill marks where you are, and this is not a
 * place — it is the one button on the bar that starts something.
 */
const RunIcon = ({ size }: TabIconProps) => (
  <View style={styles.runButton}>
    <Play color="#FF6B1A" fill="#FF6B1A" size={size - 3} />
  </View>
);

/** The Run tab never becomes the current tab; it opens the run screen. */
const Nothing = () => null;
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
        component={RunHomeScreen}
        options={{ tabBarAccessibilityLabel: 'Home', tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="City"
        component={CityScreen}
        options={{ tabBarAccessibilityLabel: 'City map', tabBarIcon: CityIcon }}
      />
      <Tab.Screen
        name="Run"
        component={Nothing}
        options={{ tabBarAccessibilityLabel: 'Start a run', tabBarIcon: RunIcon }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            navigation.getParent()?.navigate('Tracking', { kind: 'run' });
          },
        })}
      />
      <Tab.Screen
        name="Squad"
        component={GroupsScreen}
        options={{ tabBarAccessibilityLabel: 'Clubs', tabBarIcon: SquadIcon }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarAccessibilityLabel: 'Profile', tabBarIcon: ProfileIcon }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  runButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
