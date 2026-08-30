import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Dumbbell, Flame, Heart, Zap } from 'lucide-react-native';

import { Button, OptionCard, Screen } from '../../components';
import { GOAL_LABEL, type GoalId } from '../../services';
import { useProfile } from '../../hooks';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

/**
 * Titles come from `GOAL_LABEL` so the wording is identical here and in the
 * settings screen that edits it later.
 */
const GOALS: { id: GoalId; description: string }[] = [
  { id: 'lose', description: 'Cardio and plyometrics alongside strength work.' },
  { id: 'build', description: 'Strength and powerlifting movements.' },
  { id: 'endurance', description: 'Conditioning work that raises your ceiling.' },
  { id: 'healthy', description: 'Strength and cardio, nothing extreme.' },
];

/** Step 2 of profile setup: pick a primary fitness goal. */
export function ProfileGoalScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { profile, update } = useProfile();
  const goal = profile.goal;

  const iconFor = (id: GoalId, selected: boolean) => {
    const color = selected ? theme.colors.onAccent : theme.colors.text;
    switch (id) {
      case 'lose':
        return <Flame color={color} size={20} />;
      case 'build':
        return <Dumbbell color={color} size={20} />;
      case 'endurance':
        return <Zap color={color} size={20} />;
      case 'healthy':
        return <Heart color={color} size={20} />;
    }
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <SetupHeader
        step={1}
        title={"What's your\nmain goal?"}
        subtitle="We'll tailor your plan and challenges around this."
      />

      <View
        style={styles.list}
        accessibilityRole="radiogroup"
        accessibilityLabel="Fitness goal">
        {GOALS.map(g => (
          <OptionCard
            key={g.id}
            title={GOAL_LABEL[g.id]}
            description={g.description}
            selected={goal === g.id}
            onPress={() => update({ goal: g.id })}
            icon={iconFor(g.id, goal === g.id)}
          />
        ))}
      </View>

      <Button
        label="Continue"
        size="lg"
        fullWidth
        onPress={() => navigation.navigate('BodyBasics', { inSetup: true })}
        iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        style={styles.submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  list: { marginTop: 28, rowGap: 12 },
  submit: { marginTop: 28 },
});
