import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { intensityLevel, type IntensityLevel } from '../services/training';
import { useTheme } from '../theme';
import { Text } from './Text';

export type ActivityHeatmapProps = {
  /** Day key (`YYYY-MM-DD`) → minutes trained that day. */
  minutesByDay: Record<string, number>;
  /** Last day shown, normally today. */
  endDay: string;
  /** How many weeks of history to show. */
  weeks?: number;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const CELL = 15;
const GAP = 4;
const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

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
 * NEW PATTERN (Phase 8): contribution-graph heatmap.
 *
 * One cell per day, colour intensity by how long the session was. This shows
 * consistency in a way the month calendar cannot — a calendar answers "did I
 * train on the 14th", a heatmap answers "am I actually keeping this up", which
 * is the question the product is about.
 *
 * COLOUR: intensity is the accent at increasing alpha — pale for a short
 * session, full-strength for a long one.
 *
 * Note the direction. On a near-black background the intuitive "more work =
 * darker" would make the hardest days RECEDE into the background, which is
 * backwards; GitHub's dark theme inverts for the same reason. So intensity
 * increases toward the brighter, fully saturated accent, and the legend states
 * it rather than leaving the reader to infer it.
 *
 * Alpha rather than five hard-coded hexes means the ramp stays correct when the
 * accent is swapped (lime/emerald) and in light mode, where the relationship
 * naturally flips to darker-is-more against a cream page.
 */
export function ActivityHeatmap({
  minutesByDay,
  endDay,
  weeks = 18,
  selectedDay,
  onSelectDay,
  style,
  testID,
}: ActivityHeatmapProps) {
  const theme = useTheme();

  /** Columns of 7 days, Monday-first, oldest column first. */
  const columns = useMemo(() => {
    const end = new Date(`${endDay}T00:00:00`);
    // Walk forward to the Sunday that ends this week, so the final column is full.
    const endOffset = (7 - ((end.getDay() + 6) % 7) - 1) % 7;
    const gridEnd = shift(end, endOffset);
    const gridStart = shift(gridEnd, -(weeks * 7 - 1));

    const out: Date[][] = [];
    for (let w = 0; w < weeks; w += 1) {
      const col: Date[] = [];
      for (let d = 0; d < 7; d += 1) {
        col.push(shift(gridStart, w * 7 + d));
      }
      out.push(col);
    }
    return out;
  }, [endDay, weeks]);

  const colourFor = (level: IntensityLevel): string => {
    switch (level) {
      case 0:
        return theme.mode === 'dark'
          ? theme.colors.surfaceMuted
          : theme.colors.border;
      case 1:
        return withAlpha(theme.colors.accent, 0.28);
      case 2:
        return withAlpha(theme.colors.accent, 0.5);
      case 3:
        return withAlpha(theme.colors.accent, 0.78);
      case 4:
        return theme.colors.accentPressed;
    }
  };

  /** Month label sits above the first column that starts a new month. */
  const monthLabelFor = (col: Date[], index: number): string | null => {
    const first = col[0];
    if (index === 0) {
      return first.toLocaleDateString(undefined, { month: 'short' });
    }
    const prev = columns[index - 1][0];
    return prev.getMonth() !== first.getMonth()
      ? first.toLocaleDateString(undefined, { month: 'short' })
      : null;
  };

  return (
    <View testID={testID} style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Newest data is on the right, which is where attention should land.
        contentOffset={{ x: 9999, y: 0 }}>
        <View style={styles.body}>
          {/* Weekday gutter. */}
          <View style={styles.gutter}>
            <View style={styles.monthSpacer} />
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={styles.gutterCell}>
                <Text variant="label" tone="muted">
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {columns.map((col, ci) => {
            const month = monthLabelFor(col, ci);
            return (
              <View key={ci} style={styles.column}>
                <View style={styles.monthSpacer}>
                  {month ? (
                    <Text variant="label" tone="muted">
                      {month}
                    </Text>
                  ) : null}
                </View>

                {col.map(date => {
                  const key = keyOf(date);
                  const future = key > endDay;
                  const minutes = minutesByDay[key] ?? 0;
                  const level = intensityLevel(minutes);
                  const selected = key === selectedDay;

                  if (future) {
                    // Render the space so the grid stays aligned, but nothing in it.
                    return <View key={key} style={styles.cellBox} />;
                  }

                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`${key}, ${minutes} minutes`}
                      accessibilityState={{ selected }}
                      onPress={() => onSelectDay?.(key)}
                      style={styles.cellBox}>
                      <View
                        style={[
                          styles.cell,
                          { backgroundColor: colourFor(level) },
                          selected
                            ? [styles.selected, { borderColor: theme.colors.text }]
                            : null,
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend. Without it the colours are decoration, not data. */}
      <View style={styles.legend}>
        <Text variant="label" tone="muted">
          Less
        </Text>
        {([0, 1, 2, 3, 4] as IntensityLevel[]).map(l => (
          <View
            key={l}
            style={[styles.legendCell, { backgroundColor: colourFor(l) }]}
          />
        ))}
        <Text variant="label" tone="muted">
          More
        </Text>
      </View>
    </View>
  );
}

/**
 * Applies alpha to a #rrggbb colour.
 *
 * Returns the colour untouched if it is not a 6-digit hex — the accent is a
 * token and could in principle be an rgba() string, and silently producing
 * "#rgba(...)80" would be worse than no tint.
 */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex;
  }
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row' },
  gutter: { marginRight: 6 },
  gutterCell: {
    height: CELL,
    marginBottom: GAP,
    justifyContent: 'center',
  },
  column: { marginRight: GAP },
  monthSpacer: { height: 16, justifyContent: 'flex-end' },
  cellBox: { width: CELL, height: CELL, marginBottom: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 4 },
  selected: { borderWidth: 2 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 4,
    marginTop: 12,
  },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
});
