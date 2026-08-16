import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export type PageDotsProps = {
  count: number;
  /** Zero-based index of the active page. */
  index: number;
  /** Render on a dark surface. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 2): pagination indicator.
 *
 * The active dot stretches into a short accent bar rather than just changing
 * colour, which reads at a glance on a busy hero. Used by the onboarding
 * carousel and the profile-setup step counter.
 */
export function PageDots({
  count,
  index,
  onDark = false,
  style,
  testID,
}: PageDotsProps) {
  const theme = useTheme();

  const inactive = onDark ? theme.colors.borderInverse : theme.colors.borderStrong;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      style={[styles.row, style]}>
      {Array.from({ length: count }, (_, i) => {
        const active = i === index;
        const width = active ? ACTIVE_WIDTH : DOT_SIZE;
        const backgroundColor = active ? theme.colors.accent : inactive;
        return <View key={i} style={[styles.dot, { width, backgroundColor }]} />;
      })}
    </View>
  );
}

const DOT_SIZE = 8;
const ACTIVE_WIDTH = 22;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  dot: { height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
