import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowRight,
  Bell,
  Clock,
  Flame,
  LayoutGrid,
  Timer,
} from 'lucide-react-native';

import {
  AnimatedCounter,
  Avatar,
  Button,
  Card,
  Char,
  Chip,
  IconButton,
  ListRow,
  PhotoCard,
  ProgressRing,
  Screen,
  SectionHeader,
  Slider,
  Text,
  WeeklyBars,
  charStateForStreak,
} from '../../components';
import {
  PROFILE,
  TRAINING_TODAY,
  estimateSeconds,
  suggestPlan,
  totalSets,
  type Focus,
} from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { placeholderPhoto, remote, type PhotoTopic } from '../../assets/placeholders';
import { useTheme } from '../../theme';

const RING = 74;

/** Session photography matched to what the focus actually is. */
const PHOTO_FOR: Record<Focus, PhotoTopic> = {
  full: 'fitness',
  legs: 'strength',
  upper: 'strength',
  core: 'fitness',
  cardio: 'running',
};

/**
 * Home dashboard.
 *
 * The loop is unchanged and still runs top to bottom: Char and the streak (why
 * you came back), the time check-in (the one decision that unblocks
 * everything), then the session it produced. Stats sit below as reassurance,
 * never as the call to action.
 *
 * What changed is the presentation, following the reference: an avatar and
 * round icon cluster in the header, Char's card carrying a live weekly bar
 * chart, and the session itself promoted to a full-bleed photo card with the
 * fit and CTA laid over it — rather than three flat stacked panels.
 */
export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [minutes, setMinutes] = useState(15);

  const { logs, streak, atRisk, stats } = useSessions();
  const plan = useMemo(() => suggestPlan(minutes, TRAINING_TODAY), [minutes]);

  const minutesByDay = useMemo(
    () =>
      logs.reduce<Record<string, number>>((acc, l) => {
        acc[l.day] = (acc[l.day] ?? 0) + l.minutes;
        return acc;
      }, {}),
    [logs],
  );

  const fitMinutes = Math.round(estimateSeconds(plan) / 60);
  const charState = charStateForStreak(streak, { atRisk });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      {/* Header: avatar left, round icon cluster right. */}
      <View style={styles.header}>
        <Avatar name={PROFILE.name} size="md" ring />
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            Welcome back
          </Text>
          <Text variant="h2" numberOfLines={1}>
            {PROFILE.name}
          </Text>
        </View>
        <IconButton accessibilityLabel="Notifications" variant="dark" size="md">
          <Bell color={theme.colors.textInverse} size={19} />
        </IconButton>
        <IconButton accessibilityLabel="More" variant="dark" size="md">
          <LayoutGrid color={theme.colors.textInverse} size={19} />
        </IconButton>
      </View>

      <Text variant="displayMd" style={styles.hero}>
        {atRisk ? 'Keep it lit.' : 'Char is\nburning.'}
      </Text>

      {/* Char, the streak, and the week's shape in one card. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.charCard}>
        <View style={styles.charRow}>
          <Char state={charState} size={104} />
          <View style={styles.streakBlock}>
            <View style={styles.streakRow}>
              <Flame color={theme.colors.accent} size={24} />
              <AnimatedCounter value={streak} variant="statLg" tone="inverse" />
            </View>
            <Text variant="label" tone="inverseMuted" uppercase>
              Day streak
            </Text>
          </View>
        </View>

        <Text variant="bodySm" tone="inverseMuted" style={styles.streakNote}>
          {atRisk
            ? 'Nothing logged yet today. Train to hold it.'
            : 'Logged today. Char stays lit.'}
        </Text>

        <WeeklyBars
          minutesByDay={minutesByDay}
          endDay={TRAINING_TODAY}
          height={84}
          onDark
          style={styles.bars}
        />
      </Card>

      {/* The check-in. One slider — the only decision on this screen. */}
      <Card variant="light" padding="lg" radius="xxl" style={styles.checkinCard}>
        <View style={styles.checkinHead}>
          <Timer color={theme.colors.accent} size={18} />
          <Text variant="bodyStrong" style={styles.flex}>
            How much time today?
          </Text>
          <View style={styles.readout}>
            <AnimatedCounter
              value={minutes}
              variant="statSm"
              tone="accent"
              durationMs={200}
            />
            <Text variant="caption" tone="muted">
              min
            </Text>
          </View>
        </View>

        <Slider
          value={minutes}
          min={5}
          max={30}
          step={1}
          onChange={setMinutes}
          style={styles.slider}
        />
      </Card>

      {/* The session, promoted to a photo card with the fit stated on it. */}
      <PhotoCard
        source={remote(placeholderPhoto(PHOTO_FOR[plan.focus], plan.focus, 900, 620))}
        height={300}
        layout="spread"
        padding="lg"
        style={styles.sessionCard}>
        <View style={styles.sessionTop}>
          <Chip
            label=""
            value={`${fitMinutes} min`}
            variant="dark"
            icon={<Clock color={theme.colors.textInverse} size={13} />}
          />
          <Chip label="Fit" value={`${fitMinutes}/${minutes}`} variant="accent" />
        </View>

        <View>
          <Text variant="displaySm" tone="inverse">
            {plan.title}
          </Text>
          <Text variant="bodySm" tone="inverseMuted" style={styles.sessionMeta}>
            {plan.exercises.length} moves · {totalSets(plan)} sets ·{' '}
            {plan.exercises[0]?.name}
          </Text>
          <Button
            label="Start session"
            size="lg"
            fullWidth
            style={styles.sessionCta}
            onPress={() =>
              navigation.navigate('WorkoutDetail', { minutes, focus: plan.focus })
            }
            iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
          />
        </View>
      </PhotoCard>

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
          max={120}
          display={`${stats.weekMinutes}`}
          label="Minutes"
        />
        <RingStat value={streak} max={7} display={`${streak}`} label="Streak" />
      </View>

      <SectionHeader
        title="Recent"
        actionLabel="All"
        onActionPress={() => navigation.navigate('Tabs', { screen: 'History' })}
        style={styles.section}
      />
      <View style={styles.recent}>
        {logs.slice(0, 3).map(log => (
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
      <Text variant="label" tone="muted" uppercase>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 160 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingTop: 12,
  },
  hero: { marginTop: 22 },
  charCard: { marginTop: 18 },
  charRow: { flexDirection: 'row', alignItems: 'center', columnGap: 16 },
  streakBlock: { flex: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  streakNote: { marginTop: 12 },
  bars: { marginTop: 20 },
  checkinCard: { marginTop: 16 },
  checkinHead: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  readout: { flexDirection: 'row', alignItems: 'baseline', columnGap: 4 },
  slider: { marginTop: 18 },
  sessionCard: { marginTop: 16 },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  sessionMeta: { marginTop: 6 },
  sessionCta: { marginTop: 18 },
  section: { marginTop: 30 },
  rings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  ringStat: { alignItems: 'center', rowGap: 8 },
  recent: { marginTop: 6 },
});
