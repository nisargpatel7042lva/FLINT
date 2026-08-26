import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Clock } from 'lucide-react-native';

import {
  Button,
  Chip,
  PhotoCard,
  PressableScale,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  FOCUS_LABEL,
  TIME_OPTIONS,
  TRAINING_TODAY,
  buildPlan,
  estimateSeconds,
  suggestFocus,
  totalSets,
  type Focus,
} from '../../services';
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
  const todaysFocus = suggestFocus(TRAINING_TODAY);

  const plans = useMemo(() => ALL_FOCI.map(f => buildPlan(minutes, f)), [minutes]);

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        Train
      </Text>
      <Text variant="displaySm" style={styles.title}>
        How long have{'\n'}you got?
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
                navigation.navigate('WorkoutDetail', { minutes, focus: plan.focus })
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
  content: { paddingBottom: 140 },
  eyebrow: { paddingTop: 12 },
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
