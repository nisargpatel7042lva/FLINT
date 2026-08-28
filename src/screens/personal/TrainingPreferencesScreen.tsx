import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Building2, Home, Layers } from 'lucide-react-native';

import {
  Card,
  Chip,
  IconButton,
  ListRow,
  OptionCard,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  PLACE_LABEL,
  equipmentFor,
  formatHeight,
  formatWeight,
  titleCase,
  type Experience,
  type GoalId,
  type TrainingPlace,
} from '../../services';
import { useProfile } from '../../hooks';
import { useTheme } from '../../theme';

const PLACES: TrainingPlace[] = ['home', 'gym', 'both'];
const EXPERIENCES: Experience[] = ['new', 'some', 'experienced'];
const GOALS: GoalId[] = ['lose', 'build', 'endurance', 'healthy'];

/**
 * The answers from setup, editable.
 *
 * Onboarding asks these once; life changes them. Somebody who joins a gym in
 * March should not have to reinstall to stop being offered press-ups, and the
 * Train tab promises this screen exists.
 *
 * Every change takes effect immediately — there is no save button because
 * there is nothing to save: `update` persists on each tap and every screen
 * reading the profile re-renders.
 */
export function TrainingPreferencesScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { profile, update } = useProfile();

  const kit = equipmentFor(profile);

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
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>

      <Text variant="displaySm" style={styles.title}>
        Training
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        These decide which exercises the app suggests. Changes apply straight
        away.
      </Text>

      <SectionHeader title="Where you train" style={styles.section} />
      <View style={styles.list} accessibilityRole="radiogroup">
        {PLACES.map(p => (
          <OptionCard
            key={p}
            title={PLACE_LABEL[p]}
            selected={profile.place === p}
            onPress={() => update({ place: p })}
            icon={iconFor(p, profile.place === p)}
          />
        ))}
      </View>

      {/* What that answer actually unlocks, so the effect is never a mystery. */}
      <Card variant="light" padding="base" radius="xl" style={styles.kit}>
        <Text variant="label" tone="muted" uppercase>
          Equipment in your sessions
        </Text>
        <View style={styles.chips}>
          {kit.map(e => (
            <Chip key={e} label={titleCase(e)} variant="muted" />
          ))}
        </View>
      </Card>

      <SectionHeader title="Experience" style={styles.section} />
      <View style={styles.list} accessibilityRole="radiogroup">
        {EXPERIENCES.map(e => (
          <OptionCard
            key={e}
            title={EXPERIENCE_LABEL[e]}
            selected={profile.experience === e}
            onPress={() => update({ experience: e })}
          />
        ))}
      </View>

      <SectionHeader title="Goal" style={styles.section} />
      <View style={styles.list} accessibilityRole="radiogroup">
        {GOALS.map(g => (
          <OptionCard
            key={g}
            title={GOAL_LABEL[g]}
            selected={profile.goal === g}
            onPress={() => update({ goal: g })}
          />
        ))}
      </View>

      <SectionHeader
        title="About you"
        subtitle="Only used to estimate calories"
        style={styles.section}
      />
      <ListRow
        filled
        title="Height and weight"
        subtitle={
          profile.weightKg
            ? `${formatHeight(profile.heightCm, profile.units)} · ${formatWeight(
                profile.weightKg,
                profile.units,
              )}`
            : 'Not set — calories are a rough guess'
        }
        onPress={() => navigation.navigate('BodyBasics')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 6 },
  section: { marginTop: 30 },
  list: { marginTop: 12, rowGap: 10 },
  kit: { marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
