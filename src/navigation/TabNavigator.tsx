import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { House, Swords, User, Users, Zap } from 'lucide-react-native';

import { useTheme } from '../theme';
import { HomeScreen } from '../screens/HomeScreen';
import { FeedScreen } from '../screens/social/FeedScreen';
import { GroupsScreen } from '../screens/social/GroupsScreen';
import { TeamWarScreen } from '../screens/social/TeamWarScreen';
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
const FeedIcon = (p: TabIconProps) => <TabIcon {...p} Icon={Zap} />;
const WarsIcon = (p: TabIconProps) => <TabIcon {...p} Icon={Swords} />;
const GroupsIcon = (p: TabIconProps) => <TabIcon {...p} Icon={Users} />;
const ProfileIcon = (p: TabIconProps) => <TabIcon {...p} Icon={User} />;

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
            marginHorizontal: theme.spacing.base,
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
        name="Feed"
        component={FeedScreen}
        options={{ tabBarAccessibilityLabel: 'Feed', tabBarIcon: FeedIcon }}
      />
      <Tab.Screen
        name="Wars"
        component={TeamWarScreen}
        options={{ tabBarAccessibilityLabel: 'Team Wars', tabBarIcon: WarsIcon }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ tabBarAccessibilityLabel: 'Groups', tabBarIcon: GroupsIcon }}
      />
      {/* The design-system gallery lives here until a real profile screen exists. */}
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
