import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Clock, Flame, Timer } from 'lucide-react-native';

import {
  AnimatedCounter,
  Button,
  Card,
  Char,
  Chip,
  ListRow,
  ProgressRing,
  Screen,
  SectionHeader,
  Slider,
  Text,
  charStateForStreak,
} from '../../components';
import {
  SESSION_LOGS,
  TRAINING_TODAY,
  computeStats,
  currentStreak,
  estimateSeconds,
  recentLogs,
  streakAtRisk,
  WEEKLY_GOAL_MINUTES,
  suggestPlan,
  totalSets,
} from '../../services';
import { useTheme } from '../../theme';

const RING = 78;

/**
 * Home dashboard for the individual loop.
 *
 * Order is deliberate: Char and the streak first (why you came back), then the
 * time check-in (the one decision that unblocks everything), then the session
 * it produced. Stats sit below — they are reassurance, not the call to action.
 */
export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [minutes, setMinutes] = useState(15);

  const streak = useMemo(() => currentStreak(SESSION_LOGS, TRAINING_TODAY), []);
  const atRisk = useMemo(() => streakAtRisk(SESSION_LOGS, TRAINING_TODAY), []);
  const stats = useMemo(() => computeStats(SESSION_LOGS, TRAINING_TODAY), []);
  const plan = useMemo(() => suggestPlan(minutes, TRAINING_TODAY), [minutes]);

  const fitMinutes = Math.round(estimateSeconds(plan) / 60);
  const charState = charStateForStreak(streak, { atRisk });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="label" tone="accent" uppercase>
            Today
          </Text>
          <Text variant="displaySm" style={styles.title}>
            {atRisk ? 'Keep it lit.' : 'Char is burning.'}
          </Text>
        </View>
      </View>

      {/* Char + streak, the reason to come back. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.charCard}>
        <View style={styles.charRow}>
          <Char state={charState} size={116} />
          <View style={styles.streakBlock}>
            <View style={styles.streakRow}>
              <Flame color={theme.colors.accent} size={26} />
              <AnimatedCounter value={streak} variant="statLg" tone="inverse" />
            </View>
            <Text variant="label" tone="inverseMuted" uppercase>
              Day streak
            </Text>
            <Text variant="bodySm" tone="inverseMuted" style={styles.streakNote}>
              {atRisk
                ? 'Nothing logged yet today. Train to hold it.'
                : 'Logged today. Char stays lit.'}
            </Text>
          </View>
        </View>
      </Card>

      {/* The check-in. One slider, then straight into the session. */}
      <Card variant="light" padding="lg" radius="xxl" style={styles.checkinCard}>
        <View style={styles.checkinHead}>
          <Timer color={theme.colors.accent} size={18} />
          <Text variant="bodyStrong">How much time today?</Text>
        </View>

        <View style={styles.readout}>
          <AnimatedCounter
            value={minutes}
            variant="statMd"
            tone="accent"
            durationMs={200}
          />
          <Text variant="h3" tone="muted" style={styles.unit}>
            min
          </Text>
        </View>

        <Slider value={minutes} min={5} max={30} step={1} onChange={setMinutes} />

        <View style={styles.suggestion}>
          <View style={styles.flex}>
            <Text variant="h3">{plan.title}</Text>
            <Text variant="caption" tone="muted" style={styles.fit}>
              {plan.exercises.length} moves · {totalSets(plan)} sets · fits in{' '}
              {fitMinutes} min
            </Text>
          </View>
          <Chip
            label="Fit"
            value={`${fitMinutes}/${minutes}`}
            variant="muted"
            icon={<Clock color={theme.colors.textMuted} size={13} />}
          />
        </View>

        <Button
          label={`Start ${plan.title}`}
          size="lg"
          fullWidth
          style={styles.startCta}
          onPress={() => navigation.navigate('WorkoutDetail', { minutes, focus: plan.focus })}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
      </Card>

      {/* Quick stats as rings. */}
      <SectionHeader
        title="This week"
        subtitle={
          // "6 of 4 sessions" reads like a bug once the goal is beaten.
          stats.weekSessions >= stats.weekGoal
            ? `Goal hit · ${stats.weekSessions} sessions`
            : `${stats.weekSessions} of ${stats.weekGoal} sessions`
        }
        style={styles.section}
      />
      <View style={styles.rings}>
        <RingStat
          value={stats.weekSessions}
          max={stats.weekGoal}
          display={`${stats.weekSessions}`}
          label="Sessions"
        />
        <RingStat
          value={stats.weekMinutes}
          max={WEEKLY_GOAL_MINUTES}
          display={`${stats.weekMinutes}`}
          label="Minutes"
        />
        <RingStat
          value={stats.weekSessions > 0 ? streak : 0}
          max={7}
          display={`${streak}`}
          label="Streak"
        />
      </View>

      <SectionHeader
        title="Recent"
        actionLabel="All"
        onActionPress={() => navigation.navigate('Tabs', { screen: 'History' })}
        style={styles.section}
      />
      <View style={styles.recent}>
        {recentLogs(3).map(log => (
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
        ))}
      </View>
    </Screen>
  );
}

function RingStat({
  value,
  max,
  display,
  label,
}: {
  value: number;
  max: number;
  display: string;
  label: string;
}) {
  return (
    <View style={styles.ringStat}>
      <ProgressRing value={value} max={max} size={RING} strokeWidth={8} sweep={320}>
        <Text variant="bodyStrong">{display}</Text>
      </ProgressRing>
      <Text variant="label" tone="muted" uppercase style={styles.ringLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12 },
  title: { marginTop: 6 },
  charCard: { marginTop: 20 },
  charRow: { flexDirection: 'row', alignItems: 'center', columnGap: 16 },
  streakBlock: { flex: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  streakNote: { marginTop: 8 },
  checkinCard: { marginTop: 16 },
  checkinHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  readout: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 6,
    marginVertical: 14,
  },
  unit: { marginBottom: 6 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginTop: 22,
  },
  fit: { marginTop: 2 },
  startCta: { marginTop: 18 },
  section: { marginTop: 30 },
  rings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  ringStat: { alignItems: 'center', rowGap: 8 },
  ringLabel: {},
  recent: { marginTop: 6 },
});
