import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
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
  Spark,
  Chip,
  IconButton,
  ListRow,
  PhotoCard,
  ProgressRing,
  Screen,
  SectionHeader,
  Slider,
  Text,
  TourOverlay,
  TourTarget,
  WeeklyBars,
  sparkStateForStreak,
  useTour,
} from '../../components';
import {
  PLACE_LABEL,
  PROFILE,
  TRAINING_TODAY,
  barrierReminder,
  categoriesFor,
  equipmentFor,
  estimateSeconds,
  generateFocusSession,
  levelsFor,
  suggestFocus,
  totalSets,
  type Focus,
} from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { useProfile } from '../../hooks';
import type { MainTabParamList } from '../../navigation/types';
import { HOME_TOUR } from './homeTour';
import { placeholderPhoto, remote, type PhotoTopic } from '../../assets/placeholders';
import { useTheme, useThemeContext } from '../../theme';

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
 * The loop is unchanged and still runs top to bottom: Spark and the streak (why
 * you came back), the time check-in (the one decision that unblocks
 * everything), then the session it produced. Stats sit below as reassurance,
 * never as the call to action.
 *
 * What changed is the presentation, following the reference: an avatar and
 * round icon cluster in the header, Spark's card carrying a live weekly bar
 * chart, and the session itself promoted to a full-bleed photo card with the
 * fit and CTA laid over it — rather than three flat stacked panels.
 */
export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [minutes, setMinutes] = useState(15);

  const { logs, streak, atRisk, stats, loading } = useSessions();

  /*
   * Three states, not two.
   *
   * `atRisk` is false both when today is already logged AND when there is no
   * streak to lose, so keying the copy off it alone told somebody on their
   * very first morning that their spark was burning and today was logged.
   * Nothing erodes trust faster than a status line that is wrong about what
   * you just did.
   */
  const loggedToday = useMemo(
    () => logs.some(l => l.day === TRAINING_TODAY),
    [logs],
  );

  const hero = loggedToday
    ? 'Your spark is\nburning.'
    : atRisk
    ? 'Keep it lit.'
    : "Let's light it.";
  const { tourDone, setTourDone, loading: prefsLoading } = useThemeContext();
  const { start, active, steps, index } = useTour();
  const isFocused = useIsFocused();

  /*
   * Set by the last screen of the opening flow, and true only for that one
   * arrival. Landing here straight out of the introduction and being handed a
   * second walkthrough makes the whole thing read as one long tutorial, so the
   * tour waits until the next time the app is opened — by which point the
   * streak card it explains actually has something in it.
   */
  const route = useRoute<RouteProp<MainTabParamList, 'Home'>>();
  const justOnboarded = route.params?.justOnboarded ?? false;

  // The tour has no callback of its own, so the screen that owns the flag marks
  // it done the moment the overlay closes after having been open.
  const wasActive = React.useRef(false);
  useEffect(() => {
    if (active) {
      wasActive.current = true;
    } else if (wasActive.current) {
      wasActive.current = false;
      setTourDone(true);
    }
  }, [active, setTourDone, steps.length, index]);

  /*
   * First run only.
   *
   * Waits for `loading` to clear so the tour never starts against a half-drawn
   * screen, and only fires once — the flag is written when it finishes or is
   * skipped, so a reinstall shows it again but a relaunch does not.
   *
   * The focus check matters: the tab navigator keeps this screen mounted, so
   * without it, replaying the tour from Settings would spotlight Home's
   * coordinates on top of whichever tab is actually visible.
   *
   * `prefsLoading` matters just as much: until stored preferences are read,
   * `tourDone` is still its default `false`. Without this the tour replays on
   * every cold start for someone who already finished it.
   */
  useEffect(() => {
    if (
      isFocused &&
      !justOnboarded &&
      !tourDone &&
      !active &&
      !loading &&
      !prefsLoading
    ) {
      const t = setTimeout(() => start(HOME_TOUR), 600);
      return () => clearTimeout(t);
    }
  }, [isFocused, justOnboarded, tourDone, active, loading, prefsLoading, start]);
  const { profile } = useProfile();

  /*
   * The day's suggestion, drawn from the library and filtered by the profile.
   *
   * This used to call `suggestPlan`, which read the old hardcoded bodyweight
   * pools — so somebody who told us they train at a gym got press-ups on the
   * one screen they see every day, while the Train tab correctly offered them
   * barbells. The home screen is where the answer matters most.
   */
  const plan = useMemo(
    () =>
      generateFocusSession(suggestFocus(TRAINING_TODAY), minutes, {
        equipment: equipmentFor(profile),
        levels: levelsFor(profile),
        categories: categoriesFor(profile),
      }).plan,
    [minutes, profile],
  );

  const minutesByDay = useMemo(
    () =>
      logs.reduce<Record<string, number>>((acc, l) => {
        acc[l.day] = (acc[l.day] ?? 0) + l.minutes;
        return acc;
      }, {}),
    [logs],
  );

  const fitMinutes = Math.round(estimateSeconds(plan) / 60);
  const sparkState = sparkStateForStreak(streak, { atRisk });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      {/* Header: avatar left, round icon cluster right. */}
      <View style={styles.header}>
        <Avatar name={PROFILE.name} size="md" ring />
        <View style={styles.flex}>
          {/*
            "Welcome back" to somebody who has never been here is a small lie
            told in the first four words of the app. The identity below it is
            still fixture data — see PROFILE in trainingData — and moving the
            whole app onto the repository's profile is its own change.
          */}
          <Text variant="caption" tone="muted">
            {logs.length > 0 ? 'Welcome back' : 'Welcome to Flint'}
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
        {hero}
      </Text>

      {/* Spark, the streak, and the week's shape in one card. */}
      <TourTarget id="streak" style={styles.charCard}>
      <Card variant="dark" padding="lg" radius="xxl">
        <View style={styles.charRow}>
          <Spark state={sparkState} size={104} />
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

        {/*
          On a cold day Spark repeats the promise made during the opening, in
          the words of the barrier that person named. It is the one place where
          knowing why somebody started is worth more than another statistic.
        */}
        <Text variant="bodySm" tone="inverseMuted" style={styles.streakNote}>
          {loggedToday
            ? 'Logged today. Your spark stays lit.'
            : atRisk
            ? 'Nothing logged yet today. Train to hold it.'
            : profile.barrier
            ? barrierReminder(profile.barrier)
            : 'Nothing logged yet. One session starts the streak.'}
        </Text>

        <WeeklyBars
          minutesByDay={minutesByDay}
          endDay={TRAINING_TODAY}
          height={84}
          onDark
          style={styles.bars}
        />
      </Card>
      </TourTarget>

      {/* The check-in. One slider — the only decision on this screen. */}
      <TourTarget id="checkin" style={styles.checkinCard}>
      <Card variant="light" padding="lg" radius="xxl">
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
      </TourTarget>

      {/* The session, promoted to a photo card with the fit stated on it. */}
      <TourTarget id="session" style={styles.sessionCard}>
      <PhotoCard
        source={remote(placeholderPhoto(PHOTO_FOR[plan.focus], plan.focus, 900, 620))}
        height={300}
        layout="spread"
        padding="lg">
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
            {PLACE_LABEL[profile.place]} · {plan.exercises.length} moves ·{' '}
            {totalSets(plan)} sets · {plan.exercises[0]?.name}
          </Text>
          <Button
            label="Start session"
            size="lg"
            fullWidth
            style={styles.sessionCta}
            onPress={() =>
              navigation.navigate('WorkoutDetail', {
                minutes,
                focus: plan.focus,
                // Carry the exact session, so the detail screen shows this one
                // rather than re-deriving it.
                exerciseIds: plan.exercises.map(e => e.id),
              })
            }
            iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
          />
        </View>
      </PhotoCard>
      </TourTarget>

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

      <TourOverlay />
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
