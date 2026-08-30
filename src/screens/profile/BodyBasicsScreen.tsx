import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

import {
  Button,
  Card,
  IconButton,
  SectionHeader,
  SegmentedControl,
  Screen,
  Slider,
  Text,
} from '../../components';
import {
  ageFrom,
  cmToFeetInches,
  kgToLb,
  type Sex,
  type Units,
} from '../../services';
import { useProfile } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

/**
 * Starting points, not assumptions about the person.
 *
 * Sliders need a position before they can be dragged. These are near the adult
 * median so the thumb starts somewhere plausible and most people make a small
 * adjustment rather than a long drag — but nothing is saved until they touch
 * it, which is what keeps "Skip" honest.
 */
const START = { age: 25, heightCm: 170, weightKg: 70 };

const SEX_SEGMENTS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Rather not' },
];

const UNIT_SEGMENTS: { value: Units; label: string }[] = [
  { value: 'metric', label: 'cm / kg' },
  { value: 'imperial', label: 'ft / lb' },
];

/**
 * Step 3 of setup: the numbers behind calorie estimates.
 *
 * Every control is a slider rather than a text field: no keyboard, no
 * validation, no "please enter a valid height". Three drags and you are done.
 *
 * This screen is genuinely optional and says so. It changes exactly one thing
 * — whether calories are an estimate or a flat guess — and pretending
 * otherwise to raise completion would be a lie told to somebody about their
 * own body.
 */
export function BodyBasicsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'BodyBasics'>>();
  const { profile, update } = useProfile();

  /*
   * The same screen serves onboarding and Settings. In setup it carries the
   * progress dots and hands on to the next step; opened later it is a plain
   * editor that returns where it came from. Without this, changing your weight
   * from Settings dropped you back into onboarding.
   */
  const inSetup = route.params?.inSetup ?? false;

  const [age, setAge] = useState(ageFrom(profile.birthYear) ?? START.age);
  const [heightCm, setHeightCm] = useState(profile.heightCm ?? START.heightCm);
  const [weightKg, setWeightKg] = useState(profile.weightKg ?? START.weightKg);

  const imperial = profile.units === 'imperial';
  const { feet, inches } = cmToFeetInches(heightCm);

  const finish = (save: boolean) => {
    if (save) {
      update({
        birthYear: new Date().getFullYear() - age,
        heightCm,
        weightKg,
        completed: true,
      });
    } else {
      update({ completed: true });
    }

    if (inSetup) {
      navigation.navigate('FindFriends');
    } else {
      navigation.goBack();
    }
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      {inSetup ? (
        <SetupHeader
          step={2}
          title={'A few numbers\nabout you'}
          subtitle="Only used to estimate calories. Skip it and we'll use a rough figure instead."
        />
      ) : (
        <View>
          <IconButton
            accessibilityLabel="Go back"
            variant="muted"
            size="md"
            onPress={() => navigation.goBack()}>
            <ArrowLeft color={theme.colors.text} size={20} />
          </IconButton>
          <Text variant="displaySm" style={styles.title}>
            Height and weight
          </Text>
          <Text variant="body" tone="muted" style={styles.subtitle}>
            Only used to estimate calories.
          </Text>
        </View>
      )}

      <SegmentedControl<Units>
        segments={UNIT_SEGMENTS}
        value={profile.units}
        onChange={units => update({ units })}
        style={styles.units}
      />

      <SectionHeader title="Sex" subtitle="Used for the calorie formula" style={styles.section} />
      <SegmentedControl<Sex>
        segments={SEX_SEGMENTS}
        value={profile.sex}
        onChange={sex => update({ sex })}
      />

      <Card variant="light" padding="lg" radius="xl" style={styles.card}>
        <View style={styles.row}>
          <Text variant="bodyStrong">Age</Text>
          <Text variant="statSm" tone="accent">
            {age}
          </Text>
        </View>
        <Slider
          value={age}
          min={13}
          max={90}
          step={1}
          onChange={setAge}
          style={styles.slider}
        />
      </Card>

      <Card variant="light" padding="lg" radius="xl" style={styles.card}>
        <View style={styles.row}>
          <Text variant="bodyStrong">Height</Text>
          <Text variant="statSm" tone="accent">
            {imperial ? `${feet}'${inches}"` : `${heightCm} cm`}
          </Text>
        </View>
        <Slider
          value={heightCm}
          min={120}
          max={220}
          step={1}
          onChange={setHeightCm}
          style={styles.slider}
        />
      </Card>

      <Card variant="light" padding="lg" radius="xl" style={styles.card}>
        <View style={styles.row}>
          <Text variant="bodyStrong">Weight</Text>
          <Text variant="statSm" tone="accent">
            {imperial ? `${kgToLb(weightKg)} lb` : `${weightKg} kg`}
          </Text>
        </View>
        <Slider
          value={weightKg}
          min={35}
          max={200}
          step={1}
          onChange={setWeightKg}
          style={styles.slider}
        />
      </Card>

      <View style={styles.actions}>
        <Button
          label="Continue"
          size="lg"
          fullWidth
          onPress={() => finish(true)}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
        <Button
          label={inSetup ? 'Skip — use a rough estimate' : 'Cancel'}
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => finish(false)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 6 },
  units: { marginTop: 22 },
  section: { marginTop: 28 },
  card: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slider: { marginTop: 16 },
  actions: { marginTop: 26, rowGap: 4 },
});
