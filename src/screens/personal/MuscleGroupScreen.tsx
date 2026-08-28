import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Clock, Play, Shuffle } from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  IconButton,
  ListRow,
  MeterBar,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  MUSCLE_LABEL,
  PLACE_LABEL,
  REGION_FOCUS,
  REGION_LABEL,
  REGION_MUSCLES,
  TIME_OPTIONS,
  categoriesFor,
  describe,
  equipmentFor,
  estimateSeconds,
  findExercises,
  generateSession,
  levelsFor,
  totalSets,
  type Muscle,
} from '../../services';
import { useProfile } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

/**
 * One body part: a session generated for it, and the full list behind that.
 *
 * The generated session leads because it is the answer to the question that
 * brought someone here. The list underneath is what makes the answer
 * trustworthy — you can see what it chose from, and swap to browsing if you
 * had something specific in mind.
 */
export function MuscleGroupScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'MuscleGroup'>>();
  const { region } = route.params;

  const [minutes, setMinutes] = useState<number>(15);
  const [seed, setSeed] = useState(0);
  const [muscle, setMuscle] = useState<Muscle | undefined>(route.params.muscle);

  const { profile } = useProfile();

  /*
   * The session is filtered by the profile, which is the whole reason setup
   * asks where you train: a gym answer puts barbells and machines in here, a
   * home answer keeps it to what fits in a living room.
   */
  const { plan, pool } = useMemo(
    () =>
      generateSession(region, minutes, {
        seed,
        equipment: equipmentFor(profile),
        levels: levelsFor(profile),
        categories: categoriesFor(profile),
      }),
    [region, minutes, seed, profile],
  );

  const fitMinutes = Math.round(estimateSeconds(plan) / 60);

  const muscles = REGION_MUSCLES[region];
  const listed = useMemo(
    () => findExercises({ region, muscle }),
    [region, muscle],
  );

  const start = () =>
    navigation.navigate('WorkoutDetail', {
      minutes,
      focus: REGION_FOCUS[region],
      region,
      // The exact session shown above, not a recipe for regenerating it.
      exerciseIds: plan.exercises.map(e => e.id),
    });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        <Chip label="" value={`${listed.length} exercises`} variant="muted" />
      </View>

      <Text variant="displaySm" style={styles.title}>
        {REGION_LABEL[region]}
      </Text>

      {/* Budget first — everything below re-fits to it, as on the Train tab. */}
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

      <Card variant="dark" padding="lg" radius="xxl" style={styles.plan}>
        <View style={styles.planHead}>
          <Chip
            label=""
            value={`Fits ${fitMinutes} min`}
            variant="accent"
            icon={<Clock color={theme.colors.onAccent} size={13} />}
          />
          <IconButton
            accessibilityLabel="Suggest a different session"
            variant="muted"
            size="sm"
            onPress={() => setSeed(s => s + 1)}>
            <Shuffle color={theme.colors.textInverse} size={16} />
          </IconButton>
        </View>

        <Text variant="h2" tone="inverse" style={styles.planTitle}>
          {plan.title}
        </Text>
        <Text variant="bodySm" tone="inverseMuted">
          {plan.exercises.length} moves · {totalSets(plan)} sets
        </Text>

        <MeterBar
          value={Math.min((estimateSeconds(plan) / (minutes * 60)) * 100, 100)}
          style={styles.planBar}
        />

        <View style={styles.planList}>
          {plan.exercises.map((e, i) => (
            <View key={e.id} style={styles.planRow}>
              <Text variant="bodySm" tone="inverseMuted" style={styles.planIndex}>
                {i + 1}
              </Text>
              <Text variant="bodySm" tone="inverse" style={styles.flex}>
                {e.name}
              </Text>
              <Text variant="caption" tone="inverseMuted">
                {e.sets} × {e.reps ?? `${e.holdSeconds}s`}
              </Text>
            </View>
          ))}
        </View>

        <Button
          label="Start this session"
          size="md"
          fullWidth
          style={styles.planCta}
          onPress={start}
          iconLeft={<Play color={theme.colors.onAccent} size={16} />}
        />
      </Card>

      <SectionHeader
        title="All exercises"
        subtitle={
          pool.length < listed.length
            ? `The session above uses what you have ${PLACE_LABEL[
                profile.place
              ].toLowerCase()}`
            : undefined
        }
        style={styles.section}
      />

      {/* Muscle filter — the dataset's own vocabulary, one level down. */}
      {muscles.length > 1 ? (
        <View style={styles.filters}>
          <Button
            label="All"
            size="sm"
            variant={muscle === undefined ? 'primary' : 'outline'}
            onPress={() => setMuscle(undefined)}
          />
          {muscles.map(m => (
            <Button
              key={m}
              label={MUSCLE_LABEL(m)}
              size="sm"
              variant={muscle === m ? 'primary' : 'outline'}
              onPress={() => setMuscle(m)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.list}>
        {listed.map(e => (
          <ListRow
            key={e.id}
            filled
            title={e.name}
            subtitle={describe(e)}
            onPress={() => navigation.navigate('ExerciseDetail', { id: e.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  flex: { flex: 1 },
  title: { marginTop: 18 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  plan: { marginTop: 22 },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTitle: { marginTop: 14 },
  planBar: { marginTop: 14 },
  planList: { marginTop: 16, rowGap: 10 },
  planRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  planIndex: { minWidth: 16 },
  planCta: { marginTop: 20 },
  section: { marginTop: 32 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  list: { marginTop: 14, rowGap: 8 },
});
