import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { Text } from './Text';

export type HoldButtonProps = {
  label: string;
  /** Fires once the hold completes. */
  onComplete: () => void;
  /** How long to hold, in ms. */
  holdMs?: number;
  icon?: React.ReactNode;
  /** On a coloured background the track goes dark, on a light one it goes accent. */
  onAccent?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A button that has to be held, not tapped.
 *
 * For the one action that must never happen by accident: ending a run. A phone
 * in a pocket or a sweaty thumb taps things; it does not hold a button down for
 * a second. The fill shows how far through the hold you are, and letting go
 * early undoes it.
 */
export function HoldButton({
  label,
  onComplete,
  holdMs = 900,
  icon,
  onAccent = false,
  style,
}: HoldButtonProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  const begin = () => {
    progress.value = withTiming(1, { duration: holdMs, easing: Easing.linear }, done => {
      if (done) {
        runOnJS(onComplete)();
      }
    });
  };

  const release = () => {
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 180 });
  };

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const track = onAccent ? theme.colors.surfaceInverse : theme.colors.surfaceMuted;
  const bar = onAccent ? theme.colors.surfaceInverseMuted : theme.colors.accent;
  const textTone = onAccent ? 'inverse' : 'default';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold"
      onPressIn={begin}
      onPressOut={release}
      // Screen readers cannot hold; give them the action directly.
      onAccessibilityAction={onComplete}
      accessibilityActions={[{ name: 'activate' }]}
      style={[styles.button, { backgroundColor: track, borderRadius: theme.radius.pill }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: bar }, fill]} />
      <View style={styles.content}>
        {icon}
        <Text variant="button" tone={textTone}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 60, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
  },
});
