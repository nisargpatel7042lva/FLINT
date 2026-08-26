import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react-native';

import {
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  MonthCalendar,
  Screen,
  SegmentedControl,
  Text,
} from '../../components';
import { INTENSITY_LABEL, TRAINING_TODAY, intensityLevel } from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { useTheme } from '../../theme';

type View_ = 'calendar' | 'list';

const monthLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Activity history: a grid for consistency, a list for detail. */
export function HistoryScreen() {
  const theme = useTheme();

  const [mode, setMode] = useState<View_>('calendar');
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const { logs, streak, best, stats } = useSessions();

  const byDay = useMemo(
    () =>
      logs.reduce<Record<string, (typeof logs)[number]>>((acc, l) => {
        acc[l.day] = l;
        return acc;
      }, {}),
    [logs],
  );
  /** Day → minutes, the heatmap's intensity input. */
  const minutesByDay = useMemo(
    () =>
      logs.reduce<Record<string, number>>((acc, l) => {
        acc[l.day] = (acc[l.day] ?? 0) + l.minutes;
        return acc;
      }, {}),
    [logs],
  );

  const selectedLog = selected ? byDay[selected] : undefined;

  const stepMonth = (delta: number) =>
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        History
      </Text>
      <Text variant="displaySm" style={styles.title}>
        Your record
      </Text>

      <View style={styles.summary}>
        <Chip label="Streak" value={`${streak}`} variant="muted" />
        <Chip label="Best" value={`${best}`} variant="muted" />
        <Chip label="Sessions" value={`${stats.totalSessions}`} variant="muted" />
      </View>

      <SegmentedControl<View_>
        segments={[
          { value: 'calendar', label: 'Calendar' },
          { value: 'list', label: 'List' },
        ]}
        value={mode}
        onChange={setMode}
        style={styles.tabs}
      />

      {mode === 'calendar' ? (
        <View>
          <View style={styles.monthNav}>
            <IconButton
              accessibilityLabel="Previous month"
              variant="muted"
              size="sm"
              onPress={() => stepMonth(-1)}>
              <ChevronLeft color={theme.colors.text} size={18} />
            </IconButton>
            <Text variant="bodyStrong">{monthLabel(month)}</Text>
            <IconButton
              accessibilityLabel="Next month"
              variant="muted"
              size="sm"
              onPress={() => stepMonth(1)}>
              <ChevronRight color={theme.colors.text} size={18} />
            </IconButton>
          </View>

          <MonthCalendar
            month={month}
            minutesByDay={minutesByDay}
            today={TRAINING_TODAY}
            selectedDay={selected}
            onSelectDay={setSelected}
            style={styles.calendar}
          />

          {selected ? (
            selectedLog ? (
              <Card variant="light" padding="base" style={styles.detail}>
                <Text variant="bodyStrong">{selectedLog.title}</Text>
                <Text variant="caption" tone="muted" style={styles.detailMeta}>
                  {selectedLog.day} ·{' '}
                  {INTENSITY_LABEL[intensityLevel(minutesByDay[selectedLog.day] ?? 0)]}{' '}
                  · {selectedLog.completedSets}/{selectedLog.totalSets} sets
                </Text>
              </Card>
            ) : (
              <Card variant="outline" padding="base" style={styles.detail}>
                <Text variant="bodySm" tone="muted">
                  Nothing logged on {selected}.
                </Text>
              </Card>
            )
          ) : (
            <Text variant="caption" tone="muted" style={styles.hint}>
              Brighter days are longer sessions. Tap one for detail.
            </Text>
          )}
        </View>
      ) : null}

      {mode === 'list' ? (
        <View style={styles.list}>
          {logs.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              body="Your logged workouts will show up here."
            />
          ) : (
            logs.slice(0, 30).map(log => (
              <ListRow
                key={log.id}
                title={log.title}
                subtitle={`${log.day} · ${log.completedSets}/${log.totalSets} sets`}
                leading={<Flame color={theme.colors.accent} size={20} />}
                trailing={
                  <Text variant="caption" tone="muted">
                    {log.minutes} min
                  </Text>
                }
              />
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  eyebrow: { paddingTop: 12 },
  title: { marginTop: 6 },
  summary: { flexDirection: 'row', columnGap: 10, marginTop: 18 },
  tabs: { marginTop: 20 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  calendar: { marginTop: 16 },
  detail: { marginTop: 20 },
  detailMeta: { marginTop: 4 },
  hint: { marginTop: 20, textAlign: 'center' },
  list: { marginTop: 12 },
});
