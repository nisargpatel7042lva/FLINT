import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Activity, Dumbbell, House, User } from 'lucide-react-native';

import { useTheme } from '../theme';
import { HomeScreen } from '../screens/HomeScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type LucideIcon = React.ComponentType<{ color: string; size: number }>;
type TabIconProps = { focused: boolean; color: string };

/**
 * The active pill is drawn behind the icon rather than via
 * `tabBarActiveBackgroundColor` — that option fills the whole tab item and
 * ignores border radius on Android, which spills a square outside the rounded bar.
 */
function TabIcon({ Icon, focused, color }: TabIconProps & { Icon: LucideIcon }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.iconWrap,
        focused ? { backgroundColor: theme.colors.accent } : null,
      ]}>
      <Icon color={color} size={22} />
    </View>
  );
}

/**
 * The bar applies `insets.bottom` as padding on an inner container
 * (BottomTabBar.tsx), which `tabBarStyle.paddingBottom` cannot override — it
 * squeezes the icons toward the top of the bar. This floating bar already
 * clears the gesture area via its own `marginBottom`, so the bottom inset is
 * double-counted; zeroing it lets the icons centre properly.
 */
const renderTabBar = (props: BottomTabBarProps) => (
  <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
);

// Defined at module scope so React sees a stable component type across renders.
const HomeIcon = (p: TabIconProps) => <TabIcon {...p} Icon={House} />;
const ActivityIcon = (p: TabIconProps) => <TabIcon {...p} Icon={Activity} />;
const WorkoutsIcon = (p: TabIconProps) => <TabIcon {...p} Icon={Dumbbell} />;
const ProfileIcon = (p: TabIconProps) => <TabIcon {...p} Icon={User} />;

/**
 * Floating dark tab bar with an orange active state, per the reference.
 * Screens are placeholders for now — this phase only proves the shell.
 */
export function TabNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.onAccent,
        tabBarInactiveTintColor: theme.colors.textInverseMuted,
        tabBarItemStyle: styles.item,
        tabBarStyle: [
          styles.bar,
          {
            backgroundColor: theme.colors.surfaceInverse,
            borderRadius: theme.radius.pill,
            marginHorizontal: theme.spacing.xl,
            marginBottom:
              Platform.OS === 'android' ? theme.spacing.base : theme.spacing.xl,
          },
          theme.shadows.xl,
        ],
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarAccessibilityLabel: 'Home', tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="Activity"
        component={PlaceholderScreen}
        options={{ tabBarAccessibilityLabel: 'Activity', tabBarIcon: ActivityIcon }}
      />
      <Tab.Screen
        name="Workouts"
        component={PlaceholderScreen}
        options={{ tabBarAccessibilityLabel: 'Workouts', tabBarIcon: WorkoutsIcon }}
      />
      {/* The design-system gallery lives here until real screens replace it. */}
      <Tab.Screen
        name="Profile"
        component={DesignSystemScreen}
        options={{ tabBarAccessibilityLabel: 'Profile', tabBarIcon: ProfileIcon }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: 68,
    borderTopWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopColor: 'transparent',
    elevation: 12,
  },
  // Bottom tabs reserve vertical room for a label even when it is hidden, which
  // pushes the icon above centre. Zero the padding and centre explicitly.
  item: {
    height: 68,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 52,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
