import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Clock, Play, Repeat } from 'lucide-react-native';

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
import { buildPlan, estimateSeconds, totalSets } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

/**
 * The session itself, before starting.
 *
 * The time fit is stated three ways — in the title, as a chip, and as a bar
 * against the budget — because "will this actually fit?" is the question that
 * decides whether the session happens at all.
 */
export function WorkoutDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'WorkoutDetail'>>();
  const { minutes, focus } = route.params;

  const plan = useMemo(() => buildPlan(minutes, focus), [minutes, focus]);
  const fitSeconds = estimateSeconds(plan);
  const fitMinutes = Math.round(fitSeconds / 60);

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>

      <Text variant="displaySm" style={styles.title}>
        {plan.title}
      </Text>

      <View style={styles.chips}>
        <Chip
          label="Fits"
          value={`${fitMinutes} min`}
          variant="muted"
          icon={<Clock color={theme.colors.textMuted} size={13} />}
        />
        <Chip
          label="Sets"
          value={`${totalSets(plan)}`}
          variant="muted"
          icon={<Repeat color={theme.colors.textMuted} size={13} />}
        />
      </View>

      {/* Fit against the budget, drawn rather than asserted. */}
      <Card variant="dark" padding="base" radius="xxl" style={styles.fitCard}>
        <View style={styles.fitRow}>
          <Text variant="label" tone="inverseMuted" uppercase>
            Your budget
          </Text>
          <Text variant="bodyStrong" tone="inverse">
            {fitMinutes} of {minutes} min
          </Text>
        </View>
        <MeterBar
          value={fitSeconds}
          max={minutes * 60}
          style={styles.fitBar}
          trackColor={theme.colors.surfaceInverseMuted}
        />
        <Text variant="caption" tone="inverseMuted" style={styles.fitNote}>
          Includes rest between sets. Nothing here runs over.
        </Text>
      </Card>

      <SectionHeader title="The session" style={styles.section} />
      <View style={styles.list}>
        {plan.exercises.map((e, i) => (
          <ListRow
            key={e.id}
            title={e.name}
            subtitle={e.cue}
            leading={
              <Text variant="statSm" tone="muted">
                {i + 1}
              </Text>
            }
            trailing={
              <Text variant="caption" tone="muted">
                {e.sets} ×{' '}
                {e.reps !== null ? `${e.reps}` : `${e.holdSeconds}s`}
              </Text>
            }
          />
        ))}
      </View>

      <Button
        label="Start session"
        size="lg"
        fullWidth
        style={styles.cta}
        onPress={() => navigation.navigate('WorkoutLog', { minutes, focus })}
        iconLeft={<Play color={theme.colors.onAccent} size={20} fill={theme.colors.onAccent} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  chips: { flexDirection: 'row', columnGap: 10, marginTop: 14 },
  fitCard: { marginTop: 20 },
  fitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fitBar: { marginTop: 12 },
  fitNote: { marginTop: 10 },
  section: { marginTop: 28 },
  list: { marginTop: 6 },
  cta: { marginTop: 28 },
});
