import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type WeeklyBarsProps = {
  /** Day key (`YYYY-MM-DD`) → minutes trained. */
  minutesByDay: Record<string, number>;
  /** Last day shown, normally today. */
  endDay: string;
  /** Bar area height in dp. */
  height?: number;
  /** Render on a dark surface. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const keyOf = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const shift = (d: Date, delta: number) => {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
};

/**
 * NEW PATTERN (Phase 9): weekly minutes bar chart.
 *
 * The reference design leads with a bar chart of time trained, and the app had
 * no bar chart at all — rings and meters only, which show a single value well
 * but cannot show a shape across days.
 *
 * The scale is anchored to a 30-minute ceiling (the app's longest session)
 * rather than to the week's own maximum. A self-scaling chart makes a week of
 * five-minute sessions look identical to a week of thirty-minute ones, which is
 * precisely the distinction worth seeing.
 */
export function WeeklyBars({
  minutesByDay,
  endDay,
  height = 96,
  onDark = false,
  style,
  testID,
}: WeeklyBarsProps) {
  const theme = useTheme();

  /** The seven days ending today, Monday-first ordering preserved by date. */
  const days = useMemo(() => {
    const end = new Date(`${endDay}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => shift(end, -(6 - i)));
  }, [endDay]);

  const CEILING = 30;
  const total = days.reduce((n, d) => n + (minutesByDay[keyOf(d)] ?? 0), 0);

  const track = onDark ? theme.colors.surfaceInverseMuted : theme.colors.surfaceMuted;

  return (
    <View testID={testID} style={style}>
      <View style={styles.head}>
        <Text
          variant="label"
          tone={onDark ? 'inverseMuted' : 'muted'}
          uppercase
          numberOfLines={1}
          style={styles.headLabel}>
          This week
        </Text>
        <Text variant="bodyStrong" tone={onDark ? 'inverse' : 'default'}>
          {Math.floor(total / 60) > 0 ? `${Math.floor(total / 60)}h ` : ''}
          {total % 60}m
        </Text>
      </View>

      <View style={[styles.chart, { height }]}>
        {days.map(date => {
          const key = keyOf(date);
          const minutes = minutesByDay[key] ?? 0;
          const ratio = Math.min(minutes / CEILING, 1);
          const isToday = key === endDay;

          return (
            <View key={key} style={styles.column}>
              <View style={[styles.track, { backgroundColor: track }]}>
                {minutes > 0 ? (
                  <View
                    style={[
                      styles.fill,
                      {
                        // Floor keeps a 5-minute session visible as a real bar
                        // rather than a sliver indistinguishable from nothing.
                        height: `${Math.max(ratio * 100, 12)}%`,
                        backgroundColor: isToday
                          ? theme.colors.accent
                          : theme.colors.accentPressed,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.labels}>
        {days.map(date => {
          const key = keyOf(date);
          const isToday = key === endDay;
          return (
            <View key={key} style={styles.column}>
              <Text
                variant="label"
                tone={isToday ? 'accent' : onDark ? 'inverseMuted' : 'muted'}>
                {DAY_INITIALS[(date.getDay() + 6) % 7]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headLabel: { flexShrink: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', columnGap: 8 },
  column: { flex: 1, alignItems: 'center' },
  track: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 8 },
  labels: { flexDirection: 'row', columnGap: 8, marginTop: 8 },
});
