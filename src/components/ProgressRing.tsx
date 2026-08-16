import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '../theme';

export type ProgressRingProps = {
  /** Current value. Clamped against `max`. */
  value: number;
  max?: number;
  /** Outer diameter in dp. */
  size?: number;
  /** Stroke thickness in dp. */
  strokeWidth?: number;
  /** Defaults to the theme accent — the "key number" colour. */
  color?: string;
  /** Unfilled portion of the ring. */
  trackColor?: string;
  /** Degrees of sweep. 360 is a full ring; ~270 gives the open-gauge look. */
  sweep?: number;
  /** Rendered centred inside the ring — typically a number + label. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ProgressRing({
  value,
  max = 100,
  size = 160,
  strokeWidth = 14,
  color,
  trackColor,
  sweep = 360,
  children,
  style,
  testID,
}: ProgressRingProps) {
  const theme = useTheme();

  const stroke = color ?? theme.colors.accent;
  const track = trackColor ?? theme.colors.surfaceMuted;

  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.min(Math.max(value / safeMax, 0), 1);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Only `sweep` degrees of the circle are drawable; the rest is a permanent gap.
  const sweepRatio = Math.min(Math.max(sweep, 1), 360) / 360;
  const arcLength = circumference * sweepRatio;

  // Rotate so the arc starts at 12 o'clock, then back off half the gap so a
  // partial sweep stays visually centred.
  const gapDegrees = 360 - Math.min(Math.max(sweep, 1), 360);
  const rotation = -90 + gapDegrees / 2;

  return (
    <View testID={testID} style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <G rotation={rotation} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={track}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength * pct} ${circumference}`}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      {children ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
