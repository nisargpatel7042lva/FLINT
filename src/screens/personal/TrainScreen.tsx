import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Clock } from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
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
import { useTheme } from '../../theme';

const ALL_FOCI: Focus[] = ['full', 'legs', 'upper', 'core', 'cardio'];

/**
 * The time-adaptive library.
 *
 * Time is the primary axis, not muscle group — that inverts the usual fitness
 * app and matches the actual constraint: you know how long you have before you
 * know what you feel like training.
 */
export function TrainScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [minutes, setMinutes] = useState<number>(15);
  const todaysFocus = suggestFocus(TRAINING_TODAY);

  const plans = useMemo(
    () => ALL_FOCI.map(f => buildPlan(minutes, f)),
    [minutes],
  );

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
              <Card
                variant={suggested ? 'accent' : 'light'}
                padding="base"
                radius="xxl">
                <View style={styles.rowTop}>
                  <Text
                    variant="h2"
                    tone={suggested ? 'onAccent' : 'default'}
                    style={styles.flex}>
                    {FOCUS_LABEL[plan.focus]}
                  </Text>
                  <Chip
                    label=""
                    value={`${fit} min`}
                    variant={suggested ? 'dark' : 'muted'}
                    icon={
                      <Clock
                        color={
                          suggested ? theme.colors.textInverse : theme.colors.textMuted
                        }
                        size={13}
                      />
                    }
                  />
                </View>

                <Text
                  variant="bodySm"
                  tone={suggested ? 'onAccent' : 'muted'}
                  style={styles.meta}>
                  {plan.exercises.length} moves · {totalSets(plan)} sets ·{' '}
                  {plan.exercises[0]?.name}
                  {plan.exercises.length > 1 ? ` + ${plan.exercises.length - 1} more` : ''}
                </Text>

                {suggested ? (
                  <Text variant="label" tone="onAccent" uppercase style={styles.suggested}>
                    Suggested today
                  </Text>
                ) : null}
              </Card>
            </PressableScale>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  flex: { flex: 1 },
  eyebrow: { paddingTop: 12 },
  title: { marginTop: 6 },
  times: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8, marginTop: 22 },
  section: { marginTop: 30 },
  list: { marginTop: 14, rowGap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  meta: { marginTop: 6 },
  suggested: { marginTop: 10 },
});
