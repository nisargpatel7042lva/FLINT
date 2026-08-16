import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { AvatarGroup } from './AvatarGroup';
import { Text } from './Text';

export type RaceLaneData = {
  id: string;
  label: string;
  /** Points already counted. */
  score: number;
  /** Points awaiting verification, drawn as a ghost segment ahead of the bar. */
  pending?: number;
  /** Names used for the leading avatar stack. */
  memberNames?: string[];
};

export type RaceTrackProps = {
  lanes: RaceLaneData[];
  /** Fixed ceiling. Defaults to the leader's score plus headroom. */
  max?: number;
  /** Render on a dark card. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 3): head-to-head race track.
 *
 * The core "who is winning right now" visual. Bars animate to their new width
 * so the board reads as a live race rather than a static table. The leader's
 * lane takes the accent; everyone else stays muted, so the ranking is legible
 * at a glance without reading the numbers.
 *
 * Pending (unverified) points are drawn as a translucent ghost ahead of the
 * solid bar — the score never silently includes work that opponents have not
 * approved yet, but you can still see it coming.
 */
export function RaceTrack({
  lanes,
  max,
  onDark = false,
  style,
  testID,
}: RaceTrackProps) {
  const theme = useTheme();

  const best = Math.max(...lanes.map(l => l.score + (l.pending ?? 0)), 1);
  const ceiling = max ?? best * 1.15;
  const leaderScore = Math.max(...lanes.map(l => l.score));

  return (
    <View testID={testID} style={[styles.root, style]}>
      {lanes.map(lane => (
        <Lane
          key={lane.id}
          lane={lane}
          ceiling={ceiling}
          leading={lane.score === leaderScore}
          onDark={onDark}
          trackColor={
            onDark ? theme.colors.surfaceInverseMuted : theme.colors.surfaceMuted
          }
          leadColor={theme.colors.accent}
          trailColor={onDark ? theme.colors.textInverseMuted : theme.colors.borderStrong}
        />
      ))}
    </View>
  );
}

function Lane({
  lane,
  ceiling,
  leading,
  onDark,
  trackColor,
  leadColor,
  trailColor,
}: {
  lane: RaceLaneData;
  ceiling: number;
  leading: boolean;
  onDark: boolean;
  trackColor: string;
  leadColor: string;
  trailColor: string;
}) {
  const scorePct = Math.min(lane.score / ceiling, 1);
  const pendingPct = Math.min((lane.score + (lane.pending ?? 0)) / ceiling, 1);

  const solid = useSharedValue(0);
  const ghost = useSharedValue(0);

  useEffect(() => {
    solid.value = withTiming(scorePct, { duration: 900 });
    ghost.value = withTiming(pendingPct, { duration: 900 });
  }, [scorePct, pendingPct, solid, ghost]);

  const solidStyle = useAnimatedStyle(() => ({
    width: `${solid.value * 100}%`,
  }));
  const ghostStyle = useAnimatedStyle(() => ({
    width: `${ghost.value * 100}%`,
  }));

  const fill = leading ? leadColor : trailColor;

  return (
    <View style={styles.lane}>
      <View style={styles.laneHead}>
        {lane.memberNames?.length ? (
          <AvatarGroup
            names={lane.memberNames}
            max={3}
            size="sm"
            borderColor={trackColor}
          />
        ) : null}
        <Text
          variant="bodyStrong"
          tone={onDark ? 'inverse' : 'default'}
          numberOfLines={1}
          style={styles.laneLabel}>
          {lane.label}
        </Text>
        <View style={styles.laneScore}>
          <Text variant="statSm" tone={leading ? 'accent' : onDark ? 'inverseMuted' : 'muted'}>
            {lane.score.toLocaleString()}
          </Text>
          {lane.pending ? (
            <Text variant="caption" tone={onDark ? 'inverseMuted' : 'muted'}>
              +{lane.pending.toLocaleString()} pending
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[styles.ghost, ghostStyle, { backgroundColor: fill }]}
        />
        <Animated.View
          style={[styles.fill, solidStyle, { backgroundColor: fill }]}
        />
      </View>
    </View>
  );
}

const BAR_HEIGHT = 14;

const styles = StyleSheet.create({
  root: { rowGap: 18 },
  lane: { rowGap: 8 },
  laneHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  laneLabel: { flex: 1 },
  laneScore: { alignItems: 'flex-end' },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, position: 'absolute', left: 0 },
  ghost: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    position: 'absolute',
    left: 0,
    opacity: 0.3,
  },
});
