import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Dumbbell, Flame, Heart, Zap } from 'lucide-react-native';

import { Button, OptionCard, Screen } from '../../components';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

type GoalId = 'lose' | 'build' | 'endurance' | 'healthy';

const GOALS: { id: GoalId; title: string; description: string }[] = [
  { id: 'lose', title: 'Lose weight', description: 'Burn fat with steady cardio and calorie tracking.' },
  { id: 'build', title: 'Build muscle', description: 'Progressive strength work and rep tracking.' },
  { id: 'endurance', title: 'Boost endurance', description: 'Run longer, recover faster, raise your ceiling.' },
  { id: 'healthy', title: 'Stay healthy', description: 'Move daily and keep a consistent streak.' },
];

/** Step 2 of profile setup: pick a primary fitness goal. */
export function ProfileGoalScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [goal, setGoal] = useState<GoalId | null>(null);

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
            title={g.title}
            description={g.description}
            selected={goal === g.id}
            onPress={() => setGoal(g.id)}
            icon={iconFor(g.id, goal === g.id)}
          />
        ))}
      </View>

      <Button
        label="Continue"
        size="lg"
        fullWidth
        disabled={goal === null}
        onPress={() => navigation.navigate('FindFriends')}
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
