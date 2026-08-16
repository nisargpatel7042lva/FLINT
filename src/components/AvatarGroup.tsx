import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Avatar, type AvatarSize } from './Avatar';
import { Text } from './Text';

export type AvatarGroupProps = {
  /** Names used for initials. Only the first `max` are drawn. */
  names: string[];
  max?: number;
  size?: AvatarSize;
  /** Ring colour drawn around each avatar so overlaps stay legible. */
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DIAMETER: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 56, xl: 104 };

/**
 * NEW PATTERN (Phase 2): overlapping avatar stack with a "+N" overflow badge.
 *
 * Needed to show a group as a single object — friend lists, team rosters, the
 * two sides of a Team War.
 */
export function AvatarGroup({
  names,
  max = 4,
  size = 'sm',
  borderColor,
  style,
  testID,
}: AvatarGroupProps) {
  const theme = useTheme();
  const d = DIAMETER[size];
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;
  const ring = borderColor ?? theme.colors.background;
  /** Negative gap so consecutive avatars overlap by a third. */
  const overlap = -d / 3;

  return (
    <View testID={testID} style={[styles.row, style]}>
      {shown.map((name, i) => {
        const marginLeft = i === 0 ? 0 : overlap;
        return (
          <View
            key={`${name}-${i}`}
            style={[styles.item, { marginLeft, borderRadius: d / 2, borderColor: ring }]}>
            <Avatar name={name} size={size} />
          </View>
        );
      })}

      {overflow > 0 ? (
        <View
          style={[
            styles.item,
            styles.overflow,
            {
              width: d,
              height: d,
              marginLeft: overlap,
              borderRadius: d / 2,
              borderColor: ring,
              backgroundColor: theme.colors.accent,
            },
          ]}>
          <Text variant="label" tone="onAccent">
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { borderWidth: 2 },
  overflow: { alignItems: 'center', justifyContent: 'center' },
});
