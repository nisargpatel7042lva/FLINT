import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, OptionCard, Screen, Stepper, Text } from '../../components';
import {
  FREQUENCY_OPTIONS,
  GOAL_OPTIONS,
  LONGEST_OPTIONS,
  RUN_TIME_OPTIONS,
  ensureSignedIn,
  getRepository,
  saveRunnerProfile,
  suggestWeeklyGoal,
  type LongestRun,
  type RunFrequency,
  type RunGoal,
  type RunTime,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { SetupHeader } from './SetupHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** A row of pill choices: one tap, no keyboard. */
function Choices<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map(o => (
        <Button
          key={o.value}
          label={o.label}
          size="sm"
          variant={value === o.value ? 'primary' : 'outline'}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

/**
 * Setup step 2: where you are starting from.
 *
 * So the app's numbers are yours from the first day: a weekly goal on Home
 * set a little above what you do now, a first "prove us wrong" call based on
 * your real distance rather than a guess, and reminders at the time you
 * actually run. Every answer is a tap; nothing is about your body.
 */
export function RunnerProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [frequency, setFrequency] = useState<RunFrequency | null>(null);
  const [longest, setLongest] = useState<LongestRun | null>(null);
  const [goal, setGoal] = useState<RunGoal | null>(null);
  const [time, setTime] = useState<RunTime | null>(null);
  const [goalKm, setGoalKm] = useState<number | null>(null);

  const suggested = useMemo(
    () => (frequency && longest && goal ? suggestWeeklyGoal({ frequency, longest, goal }) : null),
    [frequency, longest, goal],
  );
  const weekly = goalKm ?? suggested;
  const ready = Boolean(frequency && longest && goal && time && weekly);

  const next = async () => {
    if (!frequency || !longest || !goal || !time || !weekly) {
      return;
    }
    const profile = {
      frequency,
      longest,
      goal,
      time,
      weeklyGoalKm: weekly,
      answeredAt: new Date().toISOString(),
    };
    await saveRunnerProfile(profile).catch(() => {});
    // Mirrored privately so a new phone keeps it. Best effort.
    ensureSignedIn()
      .then(u => getRepository().upsertProfile(u.uid, { runner: profile }))
      .catch(() => {});
    navigation.navigate('JoinClub');
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <SetupHeader
        step={1}
        title={'Where are you\nstarting from?'}
        subtitle="So your goals and our calls fit you from day one."
      />

      <Text variant="bodyStrong" style={styles.q}>
        How often do you run right now?
      </Text>
      <Choices options={FREQUENCY_OPTIONS} value={frequency} onChange={setFrequency} />

      <Text variant="bodyStrong" style={styles.q}>
        Your longest run lately?
      </Text>
      <Choices options={LONGEST_OPTIONS} value={longest} onChange={setLongest} />

      <Text variant="bodyStrong" style={styles.q}>
        What are you chasing?
      </Text>
      <View style={styles.goals}>
        {GOAL_OPTIONS.map(o => (
          <OptionCard
            key={o.value}
            title={o.label}
            description={o.hint}
            selected={goal === o.value}
            onPress={() => setGoal(o.value)}
          />
        ))}
      </View>

      <Text variant="bodyStrong" style={styles.q}>
        When do you usually run?
      </Text>
      <Choices options={RUN_TIME_OPTIONS} value={time} onChange={setTime} />

      {weekly ? (
        <View style={styles.goalBlock}>
          <Text variant="bodyStrong">Your weekly goal</Text>
          <Text variant="bodySm" tone="muted" style={styles.goalHint}>
            A little above where you are now. Change it any time.
          </Text>
          <Stepper
            value={weekly}
            onChange={setGoalKm}
            min={3}
            max={150}
            step={1}
            suffix="km"
            label="per week"
            style={styles.stepper}
          />
        </View>
      ) : null}

      <Button
        label="Continue"
        size="lg"
        fullWidth
        disabled={!ready}
        onPress={() => {
          next().catch(() => {});
        }}
        style={styles.continue}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  q: { marginTop: 24, marginBottom: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goals: { rowGap: 8 },
  goalBlock: { marginTop: 28, alignItems: 'center' },
  goalHint: { marginTop: 4 },
  stepper: { marginTop: 12 },
  continue: { marginTop: 32 },
});
