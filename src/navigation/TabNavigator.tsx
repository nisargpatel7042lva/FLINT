import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { CalendarDays, Dumbbell, House, User } from 'lucide-react-native';

import { useTheme } from '../theme';
import { DashboardScreen } from '../screens/personal/DashboardScreen';
import { TrainScreen } from '../screens/personal/TrainScreen';
import { HistoryScreen } from '../screens/personal/HistoryScreen';
import { ProfileScreen } from '../screens/personal/ProfileScreen';
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
      <Icon color={color} size={21} />
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
const TrainIcon = (p: TabIconProps) => <TabIcon {...p} Icon={Dumbbell} />;
const HistoryIcon = (p: TabIconProps) => <TabIcon {...p} Icon={CalendarDays} />;
const ProfileIcon = (p: TabIconProps) => <TabIcon {...p} Icon={User} />;

/**
 * PERSONAL ONLY for this phase.
 *
 * Feed / Team Wars / Groups are intentionally absent from the tab bar so the
 * individual loop stands alone. They still exist as stack routes and can be
 * re-added here in one line once the core loop is settled.
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
  item: {
    height: 68,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 46,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
