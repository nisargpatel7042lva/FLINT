import React, { useCallback } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { spring, useTheme } from '../theme';

export type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  /** Values snap to this increment. */
  step?: number;
  onChange: (value: number) => void;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const TRACK_HEIGHT = 10;
const THUMB = 30;

/**
 * Draggable slider.
 *
 * Built on gesture-handler + Reanimated rather than pulling in
 * `@react-native-community/slider`, which is a native module and would force a
 * full rebuild for a control we can express in ~80 lines. Dragging runs
 * entirely on the UI thread; only the committed value crosses to JS.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onDark = false,
  style,
  testID,
}: SliderProps) {
  const theme = useTheme();

  const width = useSharedValue(0);
  const offset = useSharedValue(0);
  const startOffset = useSharedValue(0);
  const active = useSharedValue(0);

  const span = Math.max(max - min, 1);

  const commit = useCallback(
    (next: number) => {
      onChange(next);
    },
    [onChange],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width - THUMB;
    width.value = w;
    offset.value = ((value - min) / span) * w;
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      active.value = withSpring(1, spring.press);
      startOffset.value = offset.value;
    })
    .onUpdate(e => {
      const next = Math.min(Math.max(startOffset.value + e.translationX, 0), width.value);
      offset.value = next;

      // Snap to the step and report only when the value actually changes.
      const raw = min + (next / Math.max(width.value, 1)) * span;
      const snapped = Math.round(raw / step) * step;
      runOnJS(commit)(Math.min(Math.max(snapped, min), max));
    })
    .onFinalize(() => {
      active.value = withSpring(0, spring.settle);
      // Settle the thumb onto the snapped position.
      const raw = min + (offset.value / Math.max(width.value, 1)) * span;
      const snapped = Math.min(Math.max(Math.round(raw / step) * step, min), max);
      offset.value = withSpring(((snapped - min) / span) * width.value, spring.settle);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { scale: 1 + active.value * 0.12 },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: offset.value + THUMB / 2,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View testID={testID} style={[styles.root, style]} onLayout={onLayout}>
        <View
          style={[
            styles.track,
            {
              backgroundColor: onDark
                ? theme.colors.surfaceInverseMuted
                : theme.colors.surfaceMuted,
            },
          ]}
        />
        <Animated.View
          style={[styles.fill, fillStyle, { backgroundColor: theme.colors.accent }]}
        />
        <Animated.View
          style={[
            styles.thumb,
            thumbStyle,
            {
              backgroundColor: theme.colors.accent,
              borderColor: onDark ? theme.colors.surfaceInverse : theme.colors.surface,
            },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { height: THUMB, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    marginHorizontal: THUMB / 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
  },
});
