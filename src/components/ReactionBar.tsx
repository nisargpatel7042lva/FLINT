import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import type { ReactionKey } from '../services/types';
import { Text } from './Text';

export const REACTION_GLYPH: Record<ReactionKey, string> = {
  fire: '🔥',
  strong: '💪',
  clap: '👏',
  eyes: '👀',
};

export type ReactionBarProps = {
  counts: Record<ReactionKey, number>;
  /** Reactions the current user has already given. */
  mine?: ReactionKey[];
  onToggle?: (key: ReactionKey) => void;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const ORDER: ReactionKey[] = ['fire', 'strong', 'clap', 'eyes'];

/**
 * NEW PATTERN (Phase 3): reaction row.
 *
 * The spectator layer needs lightweight, tappable acknowledgement. Counts sit
 * inline so a busy post reads as busy — that liveliness is the point of the
 * witness feed.
 */
export function ReactionBar({
  counts,
  mine = [],
  onToggle,
  onDark = false,
  style,
  testID,
}: ReactionBarProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={[styles.row, style]}>
      {ORDER.map(key => {
        const active = mine.includes(key);
        const count = counts[key] ?? 0;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${key} reaction, ${count}`}
            accessibilityState={{ selected: active }}
            onPress={() => onToggle?.(key)}
            style={({ pressed }) => [
              styles.pill,
              {
                borderRadius: theme.radius.pill,
                backgroundColor: active
                  ? theme.colors.accentSoft
                  : onDark
                  ? theme.colors.surfaceInverseMuted
                  : theme.colors.surfaceMuted,
                borderColor: active ? theme.colors.accent : TRANSPARENT,
              },
              pressed ? styles.pressed : null,
            ]}>
            <Text variant="caption">{REACTION_GLYPH[key]}</Text>
            {count > 0 ? (
              <Text
                variant="label"
                tone={active ? 'accent' : onDark ? 'inverseMuted' : 'muted'}>
                {count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', columnGap: 8, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.7 },
});
