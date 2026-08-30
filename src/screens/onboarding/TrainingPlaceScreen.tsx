import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Building2, Home, Layers } from 'lucide-react-native';

import { OptionCard, Screen, Spark, Text } from '../../components';
import {
  PLACE_EFFECT,
  PLACE_LABEL,
  type TrainingPlace,
} from '../../services';
import { useProfile } from '../../hooks';
import { useTheme } from '../../theme';
import { FlowHeader } from './FlowHeader';

const PLACES: TrainingPlace[] = ['home', 'gym', 'both'];

/**
 * Step 2: where you train.
 *
 * The only setup question that survives into the opening flow, because it is
 * the only one that changes what happens next — it decides which of 873
 * exercises the first session is allowed to draw from, and getting it wrong
 * means offering a cable crossover to somebody stood in their bedroom.
 *
 * Age, height, weight and goal are all asked later. They personalise; this one
 * qualifies, and the difference is whether the very next screen would be wrong
 * without the answer.
 *
 * Tapping a card advances. No Continue button: a screen with three options and
 * one obvious action does not need a second tap to confirm the first, and the
 * back arrow makes the choice reversible.
 */
export function TrainingPlaceScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { update } = useProfile();

  const iconFor = (place: TrainingPlace) => {
    const color = theme.colors.text;
    switch (place) {
      case 'home':
        return <Home color={color} size={20} />;
      case 'gym':
        return <Building2 color={color} size={20} />;
      default:
        return <Layers color={color} size={20} />;
    }
  };

  const choose = (place: TrainingPlace) => {
    update({ place });
    navigation.navigate('TimeBudget');
  };

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <FlowHeader step="Place" />

      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        One question
      </Text>
      <Text variant="displaySm" style={styles.title}>
        Where will you{'\n'}be training?
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        This decides what I am allowed to suggest. Nothing else in setup matters
        as much, and you can change it any time.
      </Text>

      <View style={styles.options}>
        {PLACES.map(p => (
          <OptionCard
            key={p}
            title={PLACE_LABEL[p]}
            description={PLACE_EFFECT[p]}
            icon={iconFor(p)}
            onPress={() => choose(p)}
          />
        ))}
      </View>

      <Spark state="glowing" size={96} style={styles.spark} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  eyebrow: { marginTop: 28 },
  title: { marginTop: 6 },
  subtitle: { marginTop: 10, maxWidth: 330 },
  options: { marginTop: 26, rowGap: 12 },
  spark: { alignSelf: 'center', marginTop: 'auto' },
});
