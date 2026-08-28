import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, ImageOff } from 'lucide-react-native';

import {
  Card,
  Chip,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  MUSCLE_LABEL,
  exerciseById,
  exerciseImage,
  exerciseInstructions,
  titleCase,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

/**
 * One exercise: how it looks, and how to do it.
 *
 * The instructions are the source dataset's own words, unedited. They are the
 * reason to ship a real library rather than a hand-written list — and rewriting
 * technique guidance for 873 movements would mean inventing advice about things
 * that hurt people when done wrong.
 */
export function ExerciseDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ExerciseDetail'>>();

  const exercise = exerciseById(route.params.id);
  const steps = useMemo(
    () => (exercise ? exerciseInstructions(exercise.id) : []),
    [exercise],
  );

  /** Images come from a CDN, so a phone in a basement gym may not get them. */
  const [imagesFailed, setImagesFailed] = useState(false);

  if (!exercise) {
    return (
      <Screen padding="lg">
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        <EmptyState
          title="Exercise not found"
          body="That one isn't in the library any more."
        />
      </Screen>
    );
  }

  const frames = Math.min(exercise.imageCount, 2);

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
        {exercise.name}
      </Text>

      <View style={styles.tags}>
        {exercise.equipment ? (
          <Chip label={titleCase(exercise.equipment)} variant="muted" />
        ) : null}
        <Chip label={titleCase(exercise.level)} variant="muted" />
        {exercise.mechanic ? (
          <Chip label={titleCase(exercise.mechanic)} variant="muted" />
        ) : null}
      </View>

      {frames > 0 && !imagesFailed ? (
        <View style={styles.frames}>
          {Array.from({ length: frames }, (_, i) => (
            <Image
              key={i}
              source={{ uri: exerciseImage(exercise.id, i) }}
              style={[styles.frame, { borderRadius: theme.radius.xl }]}
              resizeMode="cover"
              onError={() => setImagesFailed(true)}
              accessibilityLabel={
                i === 0 ? 'Start position' : 'End position'
              }
            />
          ))}
        </View>
      ) : (
        <Card variant="muted" padding="lg" radius="xl" style={styles.noImages}>
          <View style={styles.noImagesRow}>
            <ImageOff color={theme.colors.textMuted} size={18} />
            <Text variant="bodySm" tone="muted" style={styles.flex}>
              Illustrations need a connection. The steps below work offline.
            </Text>
          </View>
        </Card>
      )}

      <SectionHeader title="Muscles" style={styles.section} />
      <View style={styles.tags}>
        {exercise.primaryMuscles.map(m => (
          <Chip key={m} label={MUSCLE_LABEL(m)} variant="accent" />
        ))}
        {exercise.secondaryMuscles.map(m => (
          <Chip key={m} label={MUSCLE_LABEL(m)} variant="muted" />
        ))}
      </View>

      <SectionHeader title="How to do it" style={styles.section} />
      {steps.length === 0 ? (
        <Text variant="bodySm" tone="muted">
          The source library has no written steps for this one.
        </Text>
      ) : (
        <View style={styles.steps}>
          {steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text variant="statSm" tone="accent" style={styles.stepIndex}>
                {i + 1}
              </Text>
              <Text variant="body" style={styles.flex}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  frames: { flexDirection: 'row', gap: 10, marginTop: 20 },
  frame: { flex: 1, aspectRatio: 4 / 3 },
  noImages: { marginTop: 20 },
  noImagesRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  section: { marginTop: 30 },
  steps: { marginTop: 14, rowGap: 16 },
  step: { flexDirection: 'row', columnGap: 14 },
  stepIndex: { minWidth: 26 },
});
