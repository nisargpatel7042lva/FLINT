import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, spring, useTheme } from '../theme';

const BAR_HEIGHT = 68;
const PILL_WIDTH = 52;
const PILL_HEIGHT = 40;

/**
 * The bottom tab bar.
 *
 * Replaces React Navigation's `BottomTabBar` so the active pill can be a single
 * element that SLIDES between tabs, rather than a background colour that snaps
 * on and off each item. A moving object reads as one thing travelling; a colour
 * swap reads as two separate flashes, which is what made the old bar feel cheap.
 *
 * Motion follows `theme/motion.ts`:
 *  - the pill uses `spring.settle`, so it overshoots very slightly and settles
 *    (rule 1's feel, without the bounce of `spring.pop`)
 *  - the focused icon gets a small scale pop
 *  - only `transform` and `opacity` are animated, so it all runs on the UI thread
 *
 * Owning the bar also removes the need for the old `insets.bottom` override:
 * the spacing below is this component's own margin.
 */
export function KasratTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const [barWidth, setBarWidth] = useState(0);

  const count = state.routes.length;
  const slot = count > 0 ? barWidth / count : 0;

  const translateX = useSharedValue(0);
  const ready = useSharedValue(0);

  const targetFor = useCallback(
    (index: number) => index * slot + (slot - PILL_WIDTH) / 2,
    [slot],
  );

  useEffect(() => {
    if (slot <= 0) {
      return;
    }
    const target = targetFor(state.index);

    if (ready.value === 0) {
      // First layout: place the pill without animating in from x=0.
      translateX.value = target;
      ready.value = withTiming(1, { duration: duration.fast, easing: easing.standard });
      return;
    }
    translateX.value = withSpring(target, spring.settle);
  }, [state.index, slot, targetFor, translateX, ready]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: ready.value,
    transform: [{ translateX: translateX.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surfaceInverse,
          borderRadius: theme.radius.pill,
          marginHorizontal: theme.spacing.xl,
          marginBottom:
            Platform.OS === 'android' ? theme.spacing.base : theme.spacing.xl,
        },
        theme.shadows.xl,
      ]}>
      {/* The single travelling pill, behind the icons. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          pillStyle,
          { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill },
        ]}
      />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? route.name}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}>
            <TabIcon
              focused={focused}
              render={options.tabBarIcon}
              color={
                focused ? theme.colors.onAccent : theme.colors.textInverseMuted
              }
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Scale-pops on focus. Colour is swapped instantly — it rides the pill's motion. */
function TabIcon({
  focused,
  color,
  render,
}: {
  focused: boolean;
  color: string;
  render: BottomTabBarProps['descriptors'][string]['options']['tabBarIcon'];
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, spring.press);
  }, [focused, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      {render?.({ focused, color, size: 21 })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 12,
  },
  pill: {
    position: 'absolute',
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
  },
  tab: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
