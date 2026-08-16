import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export type MeterBarProps = {
  /** Current value, clamped against `max`. */
  value: number;
  max?: number;
  /** Bar thickness in dp. */
  height?: number;
  /** Defaults to the theme accent. */
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 2): linear progress meter.
 *
 * The horizontal counterpart to `ProgressRing`, for places where a ring is too
 * heavy — team scores, goal progress, water intake.
 */
export function MeterBar({
  value,
  max = 100,
  height = 8,
  color,
  trackColor,
  style,
  testID,
}: MeterBarProps) {
  const theme = useTheme();

  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.min(Math.max(value / safeMax, 0), 1);

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeMax, now: value }}
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? theme.colors.surfaceMuted,
        },
        style,
      ]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.accent,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});
