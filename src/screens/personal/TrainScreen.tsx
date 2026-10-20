import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Dumbbell,
  Footprints,
  MapPin,
  Zap,
} from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  IconButton,
  MeterBar,
  ListRow,
  PhotoCard,
  PressableScale,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  EXERCISES,
  FOCUS_LABEL,
  PLACE_LABEL,
  TIME_OPTIONS,
  TRAINING_TODAY,
  categoriesFor,
  equipmentFor,
  estimateSeconds,
  generateFocusSession,
  levelsFor,
  suggestFocus,
  totalSets,
  loadPushups,
  pushupStats,
  todayKey,
  type Focus,
} from '../../services';
import { useProfile } from '../../hooks';
import { placeholderPhoto, remote, type PhotoTopic } from '../../assets/placeholders';
import { useTheme } from '../../theme';

const ALL_FOCI: Focus[] = ['full', 'legs', 'upper', 'core', 'cardio'];

/** Each focus gets photography that matches what it actually is. */
const PHOTO_FOR: Record<Focus, PhotoTopic> = {
  full: 'fitness',
  legs: 'strength',
  upper: 'strength',
  core: 'fitness',
  cardio: 'running',
};

/**
 * The time-adaptive library.
 *
 * Time is the primary axis, not muscle group — that inverts the usual fitness
 * app and matches the actual constraint: you know how long you have before you
 * know what you feel like training.
 *
 * Sessions are photo-led cards, following the reference design: athlete
 * photography with the type sitting on top, rather than a thumbnail beside a
 * label.
 */
export function TrainScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [minutes, setMinutes] = useState<number>(15);
  const [pushups, setPushups] = useState({ best: 0, today: 0 });
  useFocusEffect(
    useCallback(() => {
      loadPushups()
        .then(sets => setPushups(pushupStats(sets, todayKey())))
        .catch(() => {});
    }, []),
  );
  const todaysFocus = suggestFocus(TRAINING_TODAY);

  const { profile } = useProfile();

  /*
   * Sessions come from the 873-exercise library, filtered by the profile.
   * These used to be thirty hand-written bodyweight moves, which meant
   * somebody who told us they train at a gym was still offered press-ups.
   */
  const plans = useMemo(
    () =>
      ALL_FOCI.map(
        f =>
          generateFocusSession(f, minutes, {
            equipment: equipmentFor(profile),
            levels: levelsFor(profile),
            categories: categoriesFor(profile),
          }).plan,
      ),
    [minutes, profile],
  );

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      {navigation.canGoBack() ? (
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
      ) : null}

      {/*
        The challenge leads. A list of sets and reps is homework; a number
        that pulses every time your chest touches the floor is a game — and
        the phone keeps score, so there is nothing to type mid-set.
      */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.challenge}>
        <View style={styles.challengeTop}>
          <Flame color={theme.colors.accent} size={22} />
          <Text variant="label" tone="accent" uppercase>
            Push-up challenge
          </Text>
        </View>
        <Text variant="h2" tone="inverse" style={styles.challengeTitle}>
          The phone counts. You push.
        </Text>
        <Text variant="bodySm" tone="inverseMuted" style={styles.challengeBody}>
          Phone on the floor under your chest — every rep is counted by the sensor. Best set:{' '}
          {pushups.best}.
        </Text>
        <View style={styles.daily}>
          <MeterBar
            value={Math.min(100, (pushups.today / 50) * 100)}
            trackColor={theme.colors.surfaceInverseMuted}
          />
          <Text variant="caption" tone="inverseMuted" style={styles.dailyText}>
            Daily 50: {pushups.today >= 50 ? 'done today' : `${pushups.today} / 50 today`}
          </Text>
        </View>
        <Button
          label="Start a set"
          size="md"
          onPress={() => navigation.navigate('Pushups')}
          style={styles.challengeBtn}
        />
      </Card>

      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        Train
      </Text>
      <Text variant="displaySm" style={styles.title}>
        How long have{'\n'}you got?
      </Text>
      <Text variant="bodySm" tone="muted" style={styles.place}>
        {PLACE_LABEL[profile.place]} · change in Profile → Training
      </Text>

      {/* Budget first. Everything below re-fits to it. */}
      <View style={styles.times}>
        {TIME_OPTIONS.map(t => (
          <Button
            key={t}
            label={`${t}m`}
            size="sm"
            variant={minutes === t ? 'primary' : 'outline'}
            onPress={() => setMinutes(t)}
          />
        ))}
      </View>

      {/*
        * The library, above the generated sessions.
        *
        * The five foci below are a curated shortcut; this is the whole
        * catalogue for someone who wants to train a specific body part or look
        * up how a movement is actually performed.
        */}
      <ListRow
        filled
        title="Browse exercises"
        subtitle={`${EXERCISES.length} movements, by body part`}
        style={styles.library}
        leading={
          <View style={styles.libraryIcon}>
            <Dumbbell color={theme.colors.accent} size={20} />
          </View>
        }
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('ExerciseLibrary')}
      />

      {/*
        * Outdoor work is a different shape of thing: no plan, no sets, just a
        * distance you did not have before. It sits above the library rather
        * than inside it because it does not answer "how long have you got" —
        * it answers "I'm going outside".
        */}
      <SectionHeader
        title="Track outdoors"
        subtitle="Live GPS, distance and pace"
        style={styles.section}
      />
      <View style={styles.outdoor}>
        {(['run', 'walk'] as const).map(kind => (
          <PressableScale
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={kind === 'run' ? 'Track a run' : 'Track a walk'}
            onPress={() => navigation.navigate('Tracking', { kind })}
            style={styles.flex}>
            <Card variant={kind === 'run' ? 'accent' : 'light'} padding="base" radius="xl">
              <View style={styles.outdoorIcon}>
                {kind === 'run' ? (
                  <Zap color={theme.colors.onAccent} size={20} />
                ) : (
                  <Footprints color={theme.colors.text} size={20} />
                )}
              </View>
              <Text
                variant="bodyStrong"
                tone={kind === 'run' ? 'onAccent' : 'default'}
                style={styles.outdoorTitle}>
                {kind === 'run' ? 'Run' : 'Walk'}
              </Text>
              <View style={styles.outdoorMeta}>
                <MapPin
                  color={kind === 'run' ? theme.colors.onAccent : theme.colors.textMuted}
                  size={12}
                />
                <Text variant="caption" tone={kind === 'run' ? 'onAccent' : 'muted'}>
                  GPS tracked
                </Text>
              </View>
            </Card>
          </PressableScale>
        ))}
      </View>

      {/* Sits under the tracking cards because it is what they add up to. */}
      <ListRow
        filled
        title="Explored"
        subtitle="The ground you've covered, and what's just past the edge"
        style={styles.library}
        leading={
          <View style={styles.libraryIcon}>
            <Compass color={theme.colors.accent} size={20} />
          </View>
        }
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('Explored')}
      />

      <SectionHeader
        title={`${minutes}-minute sessions`}
        subtitle="Every one of these fits your budget"
        style={styles.section}
      />

      <View style={styles.list}>
        {plans.map(plan => {
          const fit = Math.round(estimateSeconds(plan) / 60);
          const suggested = plan.focus === todaysFocus;

          return (
            <PressableScale
              key={plan.id}
              accessibilityRole="button"
              accessibilityLabel={plan.title}
              onPress={() =>
                navigation.navigate('WorkoutDetail', {
                  minutes,
                  focus: plan.focus,
                  // Carry the exact session, so the detail screen shows what
                  // this card showed rather than re-deriving from the profile.
                  exerciseIds: plan.exercises.map(e => e.id),
                })
              }>
              <PhotoCard
                source={remote(
                  placeholderPhoto(PHOTO_FOR[plan.focus], plan.focus, 800, 500),
                )}
                height={suggested ? 210 : 170}
                layout="spread"
                padding="base"
                highlighted={suggested}>
                {/* Top row: time fit, and the suggestion marker. */}
                <View style={styles.topRow}>
                  <Chip
                    label=""
                    value={`${fit} min`}
                    variant="dark"
                    icon={<Clock color={theme.colors.textInverse} size={13} />}
                  />
                  {suggested ? <Chip label="Suggested today" variant="accent" /> : null}
                </View>

                <View>
                  <Text variant="displaySm" tone="inverse">
                    {FOCUS_LABEL[plan.focus]}
                  </Text>
                  <Text variant="bodySm" tone="inverseMuted" style={styles.meta}>
                    {plan.exercises.length} moves · {totalSets(plan)} sets ·{' '}
                    {plan.exercises[0]?.name}
                  </Text>
                </View>
              </PhotoCard>
            </PressableScale>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  challenge: { marginTop: 16 },
  challengeTop: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  challengeTitle: { marginTop: 8 },
  challengeBody: { marginTop: 6 },
  daily: { marginTop: 14 },
  dailyText: { marginTop: 6 },
  challengeBtn: { marginTop: 16, alignSelf: 'flex-start' },
  content: { paddingBottom: 140 },
  eyebrow: { paddingTop: 12 },
  flex: { flex: 1 },
  place: { marginTop: 8 },
  library: { marginTop: 24 },
  libraryIcon: { width: 26, alignItems: 'center' },
  outdoor: { flexDirection: 'row', columnGap: 12, marginTop: 12 },
  outdoorIcon: { marginBottom: 10 },
  outdoorTitle: { marginBottom: 4 },
  outdoorMeta: { flexDirection: 'row', alignItems: 'center', columnGap: 5 },
  title: { marginTop: 6 },
  times: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginTop: 22,
  },
  section: { marginTop: 30 },
  list: { marginTop: 14, rowGap: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  meta: { marginTop: 6 },
});
