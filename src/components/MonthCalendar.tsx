import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { intensityLevel, type IntensityLevel } from '../services/training';
import { useTheme, type Theme } from '../theme';
import { Text } from './Text';

export type MonthCalendarProps = {
  /** Any date inside the month to render. */
  month: Date;
  /** Day key (`YYYY-MM-DD`) → minutes trained. Drives the colour intensity. */
  minutesByDay: Record<string, number>;
  /** Highlighted with a ring. */
  today?: string;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  /** Show the Less→More key underneath. */
  legend?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday-first column index for a date. Sunday is 6, not 0. */
export const columnOf = (d: Date): number => (d.getDay() + 6) % 7;

/**
 * The month laid out as whole weeks of exactly seven cells.
 *
 * Returning WEEKS rather than a flat list is the point. The grid used to be a
 * flat array in a `flexWrap` row with each cell at `100/7`% — which is
 * 14.285714…%, and seven of those round to fractionally over 100%, so Yoga
 * wrapped the seventh cell onto the next line. The result was six date columns
 * under seven weekday headers, and every date after the 1st sat under the
 * wrong day: in August 2026, Sunday the 2nd appeared beneath Monday.
 *
 * Weeks of seven with `flex: 1` cells cannot drift, because the row structure
 * no longer depends on rounding. It also makes the alignment testable — see
 * the invariant in the calendar tests.
 */
export function monthGrid(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (Date | null)[] = Array.from({ length: columnOf(first) }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, monthIndex, d));
  }
  // Pad the final week so every row is a full seven and the last one aligns.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const keyOf = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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

/**
 * Intensity ramp: pale accent for a short session, full strength for a long one.
 *
 * Built from accent + alpha rather than five hard-coded hexes, so it stays
 * correct when the accent is swapped (lime/emerald) and reads sensibly in light
 * mode, where the same ramp naturally becomes darker-is-more against cream.
 */
export function intensityColour(theme: Theme, level: IntensityLevel): string {
  switch (level) {
    case 0:
      return theme.mode === 'dark' ? theme.colors.surfaceMuted : theme.colors.border;
    case 1:
      return withAlpha(theme.colors.accent, 0.3);
    case 2:
      return withAlpha(theme.colors.accent, 0.52);
    case 3:
      return withAlpha(theme.colors.accent, 0.78);
    case 4:
      return theme.colors.accentPressed;
  }
}

/**
 * Month grid, shaded by how long each session was.
 *
 * A plain "trained / did not train" calendar hides the difference between a
 * five-minute token effort and a full session — which is exactly the difference
 * the product is trying to build. Shading the day cells keeps the familiar
 * month layout while making effort legible at a glance.
 */
export function MonthCalendar({
  month,
  minutesByDay,
  today,
  selectedDay,
  onSelectDay,
  legend = true,
  style,
  testID,
}: MonthCalendarProps) {
  const theme = useTheme();

  const weeks = useMemo(() => monthGrid(month), [month]);

  return (
    <View testID={testID} style={style}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={`${w}-${i}`} style={styles.cell}>
            <Text variant="label" tone="muted">
              {w}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={`week-${w}`} style={styles.weekRow}>
          {week.map((date, i) => {
          if (!date) {
            return <View key={`pad-${w}-${i}`} style={styles.cell} />;
          }

          const key = keyOf(date);
          const minutes = minutesByDay[key] ?? 0;
          const level = intensityLevel(minutes);
          const isToday = key === today;
          const selected = key === selectedDay;
          const future = today ? key > today : false;

          /*
           * Contrast across the ramp.
           *
           * The threshold has to differ by mode. In dark mode the accent sits
           * on near-black, so it is vivid from level 2 up and takes white text.
           * In light mode the same alphas sit on WHITE, so levels 1–2 come out
           * pale peach — white text on them is unreadable, and only the top two
           * bands are dark enough to carry it.
           */
          const whiteFrom = theme.mode === 'dark' ? 2 : 3;
          const tone =
            level >= whiteFrom ? 'onAccent' : level === 0 ? 'muted' : 'default';

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${key}, ${minutes} minutes`}
              accessibilityState={{ selected }}
              onPress={() => onSelectDay?.(key)}
              style={styles.cell}>
              <View
                style={[
                  styles.pip,
                  {
                    backgroundColor: intensityColour(theme, level),
                    borderColor: selected
                      ? theme.colors.text
                      : isToday
                      ? theme.colors.accent
                      : TRANSPARENT,
                  },
                  selected || isToday ? styles.ringed : null,
                  future ? styles.future : null,
                ]}>
                <Text variant="caption" tone={tone}>
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
          })}
        </View>
      ))}

      {legend ? (
        <View style={styles.legend}>
          <Text variant="label" tone="muted">
            Less
          </Text>
          {([0, 1, 2, 3, 4] as IntensityLevel[]).map(l => (
            <View
              key={l}
              style={[
                styles.legendCell,
                { backgroundColor: intensityColour(theme, l) },
              ]}
            />
          ))}
          <Text variant="label" tone="muted">
            More
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  /*
   * `flex: 1`, never a percentage width.
   *
   * `100/7`% is 14.285714…%; seven of them round to fractionally over 100% and
   * the last cell wraps, which is what put six date columns under seven
   * weekday headers. Seven flex-1 cells in a fixed row divide the space
   * exactly, whatever the rounding.
   */
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringed: { borderWidth: 2 },
  future: { opacity: 0.35 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 4,
    marginTop: 16,
  },
  legendCell: { width: 14, height: 14, borderRadius: 4 },
});
