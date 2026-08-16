import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type Segment<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 3): segmented switch.
 *
 * Needed for the challenge-type picker and the feed filters. `Button` groups
 * were the alternative but they don't communicate "one of these is active"
 * inside a single control.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  onDark = false,
  style,
  testID,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        styles.root,
        {
          backgroundColor: onDark
            ? theme.colors.surfaceInverseMuted
            : theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
        },
        style,
      ]}>
      {segments.map(seg => {
        const active = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(seg.value)}
            style={[
              styles.segment,
              {
                borderRadius: theme.radius.pill,
                backgroundColor: active ? theme.colors.accent : TRANSPARENT,
              },
            ]}>
            <Text
              variant="caption"
              tone={active ? 'onAccent' : onDark ? 'inverseMuted' : 'muted'}
              numberOfLines={1}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  root: { flexDirection: 'row', padding: 4, columnGap: 4 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
});
