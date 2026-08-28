import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Building2, Home, Layers } from 'lucide-react-native';

import { Button, OptionCard, Screen, SectionHeader, Text } from '../../components';
import {
  EXPERIENCE_LABEL,
  PLACE_LABEL,
  type Experience,
  type TrainingPlace,
} from '../../services';
import { useProfile } from '../../hooks';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

/**
 * What each answer actually changes, said plainly on the card.
 *
 * People answer setup questions better when they can see the consequence, and
 * a question whose consequence you cannot state is a question worth deleting.
 */
const PLACE_EFFECT: Record<TrainingPlace, string> = {
  home: 'Bodyweight, dumbbells and bands.',
  gym: 'Machines, barbells, cables — the full floor.',
  both: 'Everything, and you pick per session.',
};

const EXPERIENCE_EFFECT: Record<Experience, string> = {
  new: 'Beginner-friendly movements only.',
  some: 'Adds intermediate work.',
  experienced: 'The whole library, nothing held back.',
};

const PLACES: TrainingPlace[] = ['home', 'gym', 'both'];
const EXPERIENCES: Experience[] = ['new', 'some', 'experienced'];

/**
 * Step 2 of setup: where you train, and how long you have been at it.
 *
 * This is the screen that earns its place. Everything else in setup is
 * personalisation; these two answers decide which of 873 exercises the app is
 * allowed to suggest, and getting them wrong means offering a cable crossover
 * to somebody stood in their bedroom.
 *
 * Both have a default already selected, so "Continue" is always available and
 * nobody is blocked by a question they do not care about.
 */
export function TrainingSetupScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { profile, update } = useProfile();

  const iconFor = (place: TrainingPlace, selected: boolean) => {
    const color = selected ? theme.colors.onAccent : theme.colors.text;
    switch (place) {
      case 'home':
        return <Home color={color} size={20} />;
      case 'gym':
        return <Building2 color={color} size={20} />;
      default:
        return <Layers color={color} size={20} />;
    }
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <SetupHeader
        step={1}
        title={'Where do you\ntrain?'}
        subtitle="This decides which exercises we suggest. You can change it any time."
      />

      <View
        style={styles.list}
        accessibilityRole="radiogroup"
        accessibilityLabel="Where you train">
        {PLACES.map(p => (
          <OptionCard
            key={p}
            title={PLACE_LABEL[p]}
            description={PLACE_EFFECT[p]}
            selected={profile.place === p}
            onPress={() => update({ place: p })}
            icon={iconFor(p, profile.place === p)}
          />
        ))}
      </View>

      <SectionHeader title="How long have you trained?" style={styles.section} />

      <View
        style={styles.list}
        accessibilityRole="radiogroup"
        accessibilityLabel="Experience">
        {EXPERIENCES.map(e => (
          <OptionCard
            key={e}
            title={EXPERIENCE_LABEL[e]}
            description={EXPERIENCE_EFFECT[e]}
            selected={profile.experience === e}
            onPress={() => update({ experience: e })}
          />
        ))}
      </View>

      <Text variant="caption" tone="muted" style={styles.note}>
        Nothing here is locked in — Profile → Training changes it later.
      </Text>

      <Button
        label="Continue"
        size="lg"
        fullWidth
        style={styles.cta}
        onPress={() => navigation.navigate('BodyBasics', { inSetup: true })}
        iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  list: { marginTop: 20, rowGap: 10 },
  section: { marginTop: 32 },
  note: { marginTop: 22 },
  cta: { marginTop: 16 },
});
