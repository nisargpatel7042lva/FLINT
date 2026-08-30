import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { ArrowRight, Check, Clock, Flame } from 'lucide-react-native';

import {
  AnimatedCounter,
  Button,
  Card,
  Chip,
  ListRow,
  Screen,
  Spark,
  Text,
} from '../../components';
import {
  TRAINING_TODAY,
  barrierPayoff,
  categoriesFor,
  equipmentFor,
  estimateSeconds,
  generateFocusSession,
  kcalFor,
  levelsFor,
  totalSets,
  type ExercisePlan,
  type WorkoutPlan,
} from '../../services';
import { useProfile } from '../../hooks';
import { useSessions } from '../../hooks/useSessions';
import type { RootStackParamList } from '../../navigation/types';
import { duration, useTheme } from '../../theme';
import { FlowHeader } from './FlowHeader';

type Phase = 'workout' | 'ignited';

/** "12 reps" or "Hold 45s" — what you are actually being asked to do. */
const prescription = (e: ExercisePlan): string =>
  e.reps === null ? `Hold ${e.holdSeconds ?? 30}s` : `${e.reps} reps`;

/** Minutes one exercise costs, using the same maths as the whole plan. */
const minutesFor = (plan: WorkoutPlan, e: ExercisePlan): number =>
  Math.max(1, Math.round(estimateSeconds({ ...plan, exercises: [e] }) / 60));

/**
 * Steps 4 and 5: the generated session, and the first win.
 *
 * These are one screen on purpose. Completing the first exercise is the
 * emotional beat the whole flow exists for, and cutting to a new screen at that
 * moment would break it — the ignition happens in place, with Spark going from
 * glowing to celebrating and the streak counting up.
 *
 * Two things here are load-bearing and were not before:
 *
 *  - The session is REAL. It comes out of the same 873-exercise library the
 *    rest of the app uses, filtered by where the person said they train, so
 *    somebody who answered "gym" gets a barbell in their first thirty seconds
 *    rather than jumping jacks.
 *  - The completion is REAL. It is written through the same repository as every
 *    later session, so the number on this screen IS the streak rather than a
 *    picture of one. Showing a 1 here and a 0 on the home screen a moment later
 *    is the most damaging thing this flow could do.
 *
 * Account creation is deliberately not a gate. It comes after, once there is
 * something worth saving, and declining it costs nothing.
 */
export function FirstWorkoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'FirstWorkout'>>();
  const minutes = route.params?.minutes ?? 10;

  const { profile, update } = useProfile();
  const { streak, addSession } = useSessions();

  /*
   * A full-body session, drawn from the library under the profile's filters.
   *
   * Full body rather than a split: nobody's first session should depend on
   * having picked the right day of a programme, and it is the focus most likely
   * to contain something doable wherever they happen to be standing.
   */
  const { plan } = useMemo(
    () =>
      generateFocusSession('full', minutes, {
        equipment: equipmentFor(profile),
        levels: levelsFor(profile),
        categories: categoriesFor(profile),
      }),
    [minutes, profile],
  );

  const [phase, setPhase] = useState<Phase>('workout');
  const [saveError, setSaveError] = useState(false);

  const first = plan.exercises[0];
  const firstMinutes = first ? minutesFor(plan, first) : 1;

  const complete = useCallback(() => {
    // The celebration is not conditional on the write landing. They did the
    // work; a storage failure is ours to report, not theirs to be denied.
    setPhase('ignited');

    addSession({
      day: TRAINING_TODAY,
      title: plan.title,
      focus: plan.focus,
      minutes: firstMinutes,
      completedSets: first?.sets ?? 1,
      totalSets: totalSets(plan),
      kcal: kcalFor(profile, firstMinutes, 'strength'),
    }).catch(() => setSaveError(true));

    /*
     * The opening is over from here, whichever button they press next.
     *
     * Without this the app forgets them completely on the next cold start: the
     * whole flow plays again and the streak they just started is gone.
     */
    update({ completed: true });
  }, [addSession, first, firstMinutes, plan, profile, update]);

  if (phase === 'ignited') {
    return (
      <Screen padding="lg" contentContainerStyle={styles.content}>
        <View style={styles.center}>
          <Spark state="celebrating" size={180} />

          <Animated.View entering={FadeInDown.delay(duration.base).duration(duration.slow)}>
            <Text variant="displaySm" align="center" style={styles.igniteTitle}>
              That's one.
            </Text>
          </Animated.View>

          {/* The streak object itself — this is what the account will save. */}
          <Animated.View
            entering={ZoomIn.delay(duration.slow).duration(duration.base)}
            style={styles.streakWrap}>
            <Card variant="dark" padding="lg" radius="xxl" style={styles.streakCard}>
              <View style={styles.streakRow}>
                <Flame color={theme.colors.accent} size={30} />
                <AnimatedCounter
                  value={streak}
                  variant="statLg"
                  tone="inverse"
                  durationMs={520}
                />
              </View>
              <Text variant="label" tone="inverseMuted" uppercase align="center">
                Day streak
              </Text>
            </Card>
          </Animated.View>

          {/*
            The callback to what they admitted two screens ago. This is the
            whole reason that question was worth asking.
          */}
          {profile.barrier ? (
            <Animated.View
              entering={FadeIn.delay(duration.deliberate).duration(duration.slow)}>
              <Text variant="body" tone="accent" align="center" style={styles.payoff}>
                {barrierPayoff(profile.barrier, firstMinutes)}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeIn.delay(duration.deliberate + duration.base).duration(
              duration.slow,
            )}>
            <Text variant="bodySm" tone="muted" align="center" style={styles.igniteBody}>
              Your spark is lit. It stays that way as long as you keep showing up —
              and it dims if you don't. The rest of that session is waiting on your
              home screen.
            </Text>
            {saveError ? (
              <Text
                variant="caption"
                tone="muted"
                align="center"
                style={styles.saveError}>
                Saved on this device only for now — it will sync when it can.
              </Text>
            ) : null}
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(duration.deliberate + duration.base)}>
          <Button
            label="Save my streak"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate('SignUp')}
            iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
          />
          <Button
            label="Not yet — take me in"
            variant="ghost"
            size="md"
            fullWidth
            style={styles.skip}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
          />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.scrollContent}>
      <FlowHeader step="Session" />

      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="label" tone="accent" uppercase>
            Built for you
          </Text>
          <Text variant="displaySm" style={styles.title}>
            {plan.title}
          </Text>
        </View>
        <Spark state="glowing" size={84} />
      </View>

      <View style={styles.metaRow}>
        <Chip
          label="Time"
          value={`${plan.minutes} min`}
          variant="muted"
          icon={<Clock color={theme.colors.textMuted} size={14} />}
        />
        <Chip label="Moves" value={`${plan.exercises.length}`} variant="muted" />
        <Chip label="Sets" value={`${totalSets(plan)}`} variant="muted" />
      </View>

      {/* The first exercise is pulled out — the goal is one completion, now. */}
      {first ? (
        <Card variant="accent" padding="lg" radius="xxl" style={styles.firstCard}>
          <Text variant="label" tone="onAccent" uppercase>
            Start here
          </Text>
          <Text variant="h1" tone="onAccent" style={styles.firstName}>
            {first.name}
          </Text>
          <Text variant="bodySm" tone="onAccent" style={styles.firstDetail}>
            {first.sets} × {prescription(first)} · {first.cue}
          </Text>
          <Button
            label="I did it"
            variant="dark"
            size="lg"
            fullWidth
            style={styles.firstCta}
            onPress={complete}
            iconLeft={
              <Check color={theme.colors.textInverse} size={20} strokeWidth={3} />
            }
          />
        </Card>
      ) : null}

      <Text variant="bodySm" tone="muted" style={styles.restLabel}>
        Then, when you're ready
      </Text>

      <View style={styles.rest}>
        {plan.exercises.slice(1).map((e, i) => (
          <ListRow
            key={e.id}
            title={e.name}
            subtitle={e.cue}
            leading={
              <Text variant="statSm" tone="muted">
                {i + 2}
              </Text>
            }
            trailing={
              <Text variant="caption" tone="muted">
                {e.sets} × {prescription(e)}
              </Text>
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  scrollContent: { paddingBottom: 48 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 24, columnGap: 12 },
  title: { marginTop: 6 },
  metaRow: { flexDirection: 'row', columnGap: 10, marginTop: 16 },
  firstCard: { marginTop: 20 },
  firstName: { marginTop: 8 },
  firstDetail: { marginTop: 4 },
  firstCta: { marginTop: 20 },
  restLabel: { marginTop: 28 },
  rest: { marginTop: 4 },
  igniteTitle: { marginTop: 44 },
  streakWrap: { marginTop: 20 },
  streakCard: { minWidth: 200 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
  },
  payoff: { marginTop: 22, maxWidth: 320 },
  igniteBody: { marginTop: 16, maxWidth: 320 },
  saveError: { marginTop: 10, maxWidth: 320 },
  skip: { marginTop: 4 },
});
