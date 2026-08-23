import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Check, Flame, SkipForward, X } from 'lucide-react-native';

import {
  AnimatedCounter,
  Button,
  Card,
  Char,
  Chip,
  IconButton,
  MeterBar,
  Screen,
  Stepper,
  Text,
} from '../../components';
import { TRAINING_TODAY, buildPlan, totalSets } from '../../services';
import { useSessions } from '../../hooks/useSessions';
import type { RootStackParamList } from '../../navigation/types';
import { duration, useTheme } from '../../theme';

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Active session logging.
 *
 * Friction is the enemy, so the default path is ONE TAP PER SET: the rep target
 * is pre-filled, "Log set" commits it, and the screen advances itself — through
 * the sets of an exercise, then to the next exercise, then to the summary. The
 * stepper is there for the times you did nine instead of twelve; it is never on
 * the critical path, and there is no text input anywhere.
 */
export function WorkoutLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'WorkoutLog'>>();
  const { minutes, focus } = route.params;

  const plan = useMemo(() => buildPlan(minutes, focus), [minutes, focus]);
  const planSets = totalSets(plan);

  const [done, setDone] = useState<Record<string, number>>({});
  const [reps, setReps] = useState<number>(plan.exercises[0]?.reps ?? 10);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  // The streak comes from the repository, so it updates once the write lands
  // rather than being guessed locally.
  const { streak: liveStreak, addSession } = useSessions();
  const [saveError, setSaveError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, []);

  const completedSets = Object.values(done).reduce((n, v) => n + v, 0);

  // The first exercise that still has sets left is the current one.
  const currentIndex = plan.exercises.findIndex(
    e => (done[e.id] ?? 0) < e.sets,
  );
  const current = currentIndex >= 0 ? plan.exercises[currentIndex] : null;

  // Keep the stepper primed with the next exercise's target.
  useEffect(() => {
    if (current) {
      setReps(current.reps ?? current.holdSeconds ?? 10);
    }
  }, [current]);

  const finish = (completed: number) => {
    if (timer.current) {
      clearInterval(timer.current);
    }
    setFinished(true);

    // Persist through the repository. The streak then updates from the data,
    // not from an optimistic guess.
    addSession({
      day: TRAINING_TODAY,
      title: plan.title,
      focus: plan.focus,
      minutes: plan.minutes,
      completedSets: completed,
      totalSets: planSets,
      // TODO: replace with Health Connect active calories for the session
      // window once permissions are granted (services/health.ts).
      kcal: Math.round(plan.minutes * 8),
    }).catch(e => setSaveError(e instanceof Error ? e.message : String(e)));
  };

  const logSet = () => {
    if (!current) {
      return;
    }
    const next = { ...done, [current.id]: (done[current.id] ?? 0) + 1 };
    setDone(next);

    const allDone = plan.exercises.every(e => (next[e.id] ?? 0) >= e.sets);
    if (allDone) {
      finish(Object.values(next).reduce((n, v) => n + v, 0));
    }
  };

  const skipExercise = () => {
    if (!current) {
      return;
    }
    const next = { ...done, [current.id]: current.sets };
    setDone(next);
    if (plan.exercises.every(e => (next[e.id] ?? 0) >= e.sets)) {
      finish(Object.values(next).reduce((n, v) => n + v, 0));
    }
  };

  if (finished) {
    return (
      <Screen padding="lg" contentContainerStyle={styles.doneContent}>
        <View style={styles.center}>
          <Char state="celebrating" size={168} />

          <Animated.View entering={FadeIn.delay(duration.base)}>
            <Text variant="displaySm" align="center" style={styles.doneTitle}>
              Session done.
            </Text>
          </Animated.View>

          <Animated.View entering={ZoomIn.delay(duration.slow)} style={styles.streakWrap}>
            <Card variant="dark" padding="lg" radius="xxl">
              <View style={styles.streakRow}>
                <Flame color={theme.colors.accent} size={28} />
                <AnimatedCounter value={liveStreak} variant="statLg" tone="inverse" />
              </View>
              <Text variant="label" tone="inverseMuted" uppercase align="center">
                Day streak
              </Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(duration.deliberate)}>
            <View style={styles.summaryRow}>
              <Chip label="Time" value={mmss(elapsed)} variant="muted" />
              <Chip label="Sets" value={`${completedSets}/${planSets}`} variant="muted" />
            </View>
            {saveError ? (
              <Text variant="caption" tone="danger" align="center" style={styles.saveError}>
                Saved locally only: {saveError}
              </Text>
            ) : null}
          </Animated.View>
        </View>

        <Button
          label="Done"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
        />
      </Screen>
    );
  }

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Abandon session"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <X color={theme.colors.text} size={20} />
        </IconButton>
        <Chip label="" value={mmss(elapsed)} variant="muted" />
      </View>

      {/* Session progress. */}
      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <Text variant="label" tone="muted" uppercase>
            {plan.title}
          </Text>
          <Text variant="label" tone="muted">
            {completedSets}/{planSets} sets
          </Text>
        </View>
        <MeterBar value={completedSets} max={planSets} style={styles.progressBar} />
      </View>

      {current ? (
        <View style={styles.body}>
          <Text variant="label" tone="accent" uppercase>
            Exercise {currentIndex + 1} of {plan.exercises.length}
          </Text>
          <Text variant="displaySm" style={styles.exercise}>
            {current.name}
          </Text>
          <Text variant="body" tone="muted" style={styles.cue}>
            {current.cue}
          </Text>

          {/* Set pips — progress within this exercise. */}
          <View style={styles.pips}>
            {Array.from({ length: current.sets }, (_, i) => {
              const complete = i < (done[current.id] ?? 0);
              return (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    {
                      backgroundColor: complete
                        ? theme.colors.accent
                        : theme.colors.surfaceMuted,
                    },
                  ]}>
                  <Text variant="label" tone={complete ? 'onAccent' : 'muted'}>
                    {i + 1}
                  </Text>
                </View>
              );
            })}
          </View>

          <Card variant="light" padding="lg" radius="xxl" style={styles.repCard}>
            <Stepper
              value={reps}
              onChange={setReps}
              min={1}
              max={200}
              label={current.reps !== null ? 'reps' : 'seconds'}
              style={styles.stepper}
            />
            <Text variant="caption" tone="muted" align="center" style={styles.repHint}>
              Target {current.reps ?? current.holdSeconds}. Adjust only if it differed.
            </Text>
          </Card>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Log set"
          size="lg"
          fullWidth
          onPress={logSet}
          iconLeft={<Check color={theme.colors.onAccent} size={20} strokeWidth={3} />}
        />
        <Button
          label="Skip exercise"
          variant="ghost"
          size="md"
          fullWidth
          style={styles.skip}
          onPress={skipExercise}
          iconLeft={<SkipForward color={theme.colors.accent} size={16} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  doneContent: { flex: 1, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  progress: { marginTop: 20 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {},
  body: { flex: 1, justifyContent: 'center' },
  exercise: { marginTop: 8 },
  cue: { marginTop: 8 },
  pips: { flexDirection: 'row', columnGap: 10, marginTop: 24 },
  pip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repCard: { marginTop: 28 },
  stepper: { alignSelf: 'center' },
  repHint: { marginTop: 14 },
  actions: {},
  skip: { marginTop: 4 },
  doneTitle: { marginTop: 40 },
  streakWrap: { marginTop: 20 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
  },
  summaryRow: { flexDirection: 'row', columnGap: 10, marginTop: 24 },
  saveError: { marginTop: 12 },
});
