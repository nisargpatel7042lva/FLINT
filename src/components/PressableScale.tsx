import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { scale as scaleToken, spring } from '../theme';

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Depth of the compression. Defaults to `scale.pressIn`. */
  pressedScale?: number;
};

/**
 * Implements rule 1 of `theme/motion.ts`: taps get a subtle spring scale-pop,
 * never a colour flash alone.
 *
 * Wrap any custom tappable surface in this rather than re-deriving press
 * feedback per screen. `Button` and `IconButton` already have their own press
 * treatment; this is for composite targets like selection cards.
 */
export function PressableScale({
  children,
  style,
  pressedScale = scaleToken.pressIn,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value }],
  }));

  return (
    <Pressable
      {...rest}
      onPressIn={e => {
        pressed.value = withSpring(pressedScale, spring.press);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        pressed.value = withSpring(1, spring.settle);
        onPressOut?.(e);
      }}
      // Layout styles must land on the Pressable itself. Putting them on the
      // inner Animated.View leaves the touchable with no flex basis, which
      // silently breaks any grid the caller builds out of these.
      style={style}>
      <Animated.View style={[styles.inner, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1 },
});
