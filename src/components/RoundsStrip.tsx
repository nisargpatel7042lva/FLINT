import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type RoundOutcome = 'win' | 'loss' | 'tie' | 'live' | 'upcoming';

export type RoundsStripProps = {
  /** One entry per day of the war, in order. */
  rounds: { label: string; outcome: RoundOutcome }[];
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 3): daily round history.
 *
 * Team Wars are decided by days won, not cumulative points, so the standing is
 * unreadable without a per-day strip. Each cell shows one round's outcome from
 * the viewer's perspective.
 */
export function RoundsStrip({
  rounds,
  onDark = false,
  style,
  testID,
}: RoundsStripProps) {
  const theme = useTheme();

  const fillFor = (o: RoundOutcome) => {
    switch (o) {
      case 'win':
        return theme.colors.accent;
      case 'loss':
        return onDark ? theme.colors.textInverseMuted : theme.colors.borderStrong;
      case 'tie':
        return onDark ? theme.colors.surfaceInverseMuted : theme.colors.surfaceMuted;
      case 'live':
        return theme.colors.accentSoft;
      default:
        return onDark ? theme.colors.surfaceInverseMuted : theme.colors.surfaceMuted;
    }
  };

  const glyphFor = (o: RoundOutcome) => {
    switch (o) {
      case 'win':
        return 'W';
      case 'loss':
        return 'L';
      case 'tie':
        return '–';
      case 'live':
        return '•';
      default:
        return '';
    }
  };

  return (
    <View testID={testID} style={[styles.row, style]}>
      {rounds.map((r, i) => {
        const live = r.outcome === 'live';
        const borderWidth = live ? LIVE_BORDER : 0;
        return (
          <View key={`${r.label}-${i}`} style={styles.cell}>
            <View
              style={[
                styles.pip,
                {
                  backgroundColor: fillFor(r.outcome),
                  borderColor: live ? theme.colors.accent : TRANSPARENT,
                  borderWidth,
                },
              ]}>
              <Text
                variant="label"
                tone={r.outcome === 'win' ? 'onAccent' : onDark ? 'inverse' : 'default'}>
                {glyphFor(r.outcome)}
              </Text>
            </View>
            <Text variant="label" tone={onDark ? 'inverseMuted' : 'muted'}>
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const TRANSPARENT = 'transparent';
const LIVE_BORDER = 2;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 6 },
  cell: { alignItems: 'center', rowGap: 6, flex: 1 },
  pip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
