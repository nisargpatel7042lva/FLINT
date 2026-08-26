import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, Flame, Timer, Trophy } from 'lucide-react-native';

import {
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  MonthCalendar,
  PhotoCard,
  Screen,
  SegmentedControl,
  StatPill,
  Text,
} from '../../components';
import { INTENSITY_LABEL, TRAINING_TODAY, intensityLevel } from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { placeholderPhoto, remote } from '../../assets/placeholders';
import { ThemeScope, useTheme } from '../../theme';

type View_ = 'calendar' | 'list';

const monthLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/**
 * Activity history.
 *
 * The calendar stays the centre of the screen — shaded by session length, so it
 * distinguishes a five-minute token effort from a full session. The chrome
 * around it follows the reference: a photo-led hero carrying the headline
 * numbers, and the grid housed in a card rather than floating bare on the page.
 */
/** Light-mode screen, per the reference's cream pages. */
export function HistoryScreen() {
  return (
    <ThemeScope mode="light">
      <HistoryContent />
    </ThemeScope>
  );
}

function HistoryContent() {
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

  /** Day → minutes, the calendar's intensity input. */
  const minutesByDay = useMemo(
    () =>
      logs.reduce<Record<string, number>>((acc, l) => {
        acc[l.day] = (acc[l.day] ?? 0) + l.minutes;
        return acc;
      }, {}),
    [logs],
  );

  /** Totals for whichever month is on screen, not for all time. */
  const monthStats = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
      2,
      '0',
    )}`;
    const inMonth = logs.filter(l => l.day.startsWith(prefix));
    return {
      sessions: inMonth.length,
      minutes: inMonth.reduce((n, l) => n + l.minutes, 0),
      longest: inMonth.reduce((n, l) => Math.max(n, l.minutes), 0),
    };
  }, [logs, month]);

  const selectedLog = selected ? byDay[selected] : undefined;

  const stepMonth = (delta: number) =>
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      {/* Photo-led hero carrying the headline numbers. */}
      <PhotoCard
        source={remote(placeholderPhoto('running', 'history-hero', 900, 560))}
        height={190}
        layout="spread"
        padding="lg"
        style={styles.hero}>
        <View style={styles.heroTop}>
          <Chip
            label=""
            value={`${streak} day streak`}
            variant="dark"
            icon={<Flame color={theme.colors.accent} size={13} />}
          />
          <Chip
            label="Best"
            value={`${best}`}
            variant="dark"
            icon={<Trophy color={theme.colors.accent} size={13} />}
          />
        </View>

        <View>
          <Text variant="displaySm" tone="inverse">
            Your record
          </Text>
          <Text variant="bodySm" tone="inverseMuted" style={styles.heroMeta}>
            {stats.totalSessions} sessions · {stats.totalMinutes} minutes trained
          </Text>
        </View>
      </PhotoCard>

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
          <Card variant="light" padding="lg" radius="xxl" style={styles.calendarCard}>
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
          </Card>

          {selected ? (
            <Card
              variant={selectedLog ? 'light' : 'outline'}
              padding="base"
              style={styles.detail}>
              <Text variant="bodyStrong">
                {selectedLog ? selectedLog.title : 'Rest day'}
              </Text>
              <Text variant="caption" tone="muted" style={styles.detailMeta}>
                {selected} ·{' '}
                {INTENSITY_LABEL[intensityLevel(minutesByDay[selected] ?? 0)]}
                {selectedLog
                  ? ` · ${selectedLog.completedSets}/${selectedLog.totalSets} sets`
                  : ''}
              </Text>
            </Card>
          ) : (
            <Text variant="caption" tone="muted" style={styles.hint}>
              {/*
                The ramp's direction flips with the mode: accent-over-black gets
                brighter with effort, accent-over-white gets deeper. The hint has
                to follow, or it contradicts what is on screen.
              */}
              {theme.mode === 'dark'
                ? 'Brighter days are longer sessions. Tap one for detail.'
                : 'Deeper orange means a longer session. Tap one for detail.'}
            </Text>
          )}

          {/* Totals for the month on screen, not for all time. */}
          <View style={styles.monthStats}>
            <StatPill
              value={monthStats.sessions}
              label="Sessions"
              variant="light"
              size="sm"
            />
            <StatPill
              value={monthStats.minutes}
              label="Minutes"
              variant="light"
              size="sm"
              icon={<Timer color={theme.colors.accent} size={15} />}
            />
            <StatPill
              value={monthStats.longest}
              label="Longest"
              variant="accent"
              size="sm"
            />
          </View>
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
                filled
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
  content: { paddingBottom: 160 },
  hero: { marginTop: 14 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  heroMeta: { marginTop: 6 },
  tabs: { marginTop: 18 },
  calendarCard: { marginTop: 18 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendar: { marginTop: 18 },
  detail: { marginTop: 16 },
  detailMeta: { marginTop: 4 },
  hint: { marginTop: 16, textAlign: 'center' },
  monthStats: { flexDirection: 'row', columnGap: 10, marginTop: 22 },
  list: { marginTop: 14, rowGap: 8 },
});
