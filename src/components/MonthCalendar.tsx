import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type MonthCalendarProps = {
  /** Any date inside the month to render. */
  month: Date;
  /** `YYYY-MM-DD` keys that should read as "trained". */
  markedDays: Set<string>;
  /** Highlighted with a ring. */
  today?: string;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const keyOf = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * NEW PATTERN (Phase 5): month grid.
 *
 * History needs a shape that shows consistency at a glance — a list tells you
 * what you did, a grid tells you whether you are actually showing up. Marked
 * days are filled with the accent so gaps are the thing you notice.
 */
export function MonthCalendar({
  month,
  markedDays,
  today,
  selectedDay,
  onSelectDay,
  style,
  testID,
}: MonthCalendarProps) {
  const theme = useTheme();

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();

    // Monday-first offset.
    const lead = (first.getDay() + 6) % 7;

    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return out;
  }, [month]);

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

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) {
            return <View key={`pad-${i}`} style={styles.cell} />;
          }

          const key = keyOf(date);
          const marked = markedDays.has(key);
          const isToday = key === today;
          const selected = key === selectedDay;

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key}
              accessibilityState={{ selected }}
              onPress={() => onSelectDay?.(key)}
              style={styles.cell}>
              <View
                style={[
                  styles.pip,
                  {
                    backgroundColor: marked
                      ? theme.colors.accent
                      : theme.colors.surfaceMuted,
                    borderColor: selected
                      ? theme.colors.text
                      : isToday
                      ? theme.colors.accent
                      : TRANSPARENT,
                  },
                  selected || isToday ? styles.ringed : null,
                ]}>
                <Text
                  variant="caption"
                  tone={marked ? 'onAccent' : 'muted'}>
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringed: { borderWidth: 2 },
});
