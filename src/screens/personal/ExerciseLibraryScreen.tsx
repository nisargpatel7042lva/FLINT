import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Activity,
  Anchor,
  ArrowLeft,
  Dumbbell,
  Footprints,
  HeartPulse,
  Search,
  Shield,
} from 'lucide-react-native';

import {
  Card,
  IconButton,
  Input,
  ListRow,
  PressableScale,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import type { BodyRegion } from '../../services';
import {
  BODY_REGIONS,
  EXERCISES,
  REGION_LABEL,
  describe,
  findExercises,
  regionCounts,
} from '../../services';
import { useTheme } from '../../theme';

const MAX_RESULTS = 40;

/**
 * One icon per region.
 *
 * Six identical dumbbells is a grid you have to read rather than scan. Lucide
 * has no anatomical set, so these are the nearest recognisable shapes — the
 * job is to make the tiles tellable apart at a glance, not to be a diagram.
 */
const REGION_ICON: Record<BodyRegion, React.ComponentType<{ color: string; size: number }>> = {
  chest: HeartPulse,
  back: Shield,
  arms: Dumbbell,
  shoulders: Anchor,
  core: Activity,
  legs: Footprints,
};

/**
 * The exercise library: pick a body part, or search all 873.
 *
 * The region tiles come first because "what do I want to train today" is a
 * question about a body part, not about an exercise name. Search exists for
 * the other case — you already know what you are looking for.
 */
export function ExerciseLibraryScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');

  const counts = useMemo(() => regionCounts(), []);

  const term = query.trim();
  const results = useMemo(
    () => (term.length < 2 ? [] : findExercises({ search: term }).slice(0, MAX_RESULTS)),
    [term],
  );

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
        Exercises
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {EXERCISES.length} movements with instructions. Works offline.
      </Text>

      <Input
        placeholder="Search exercises"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        iconLeft={<Search color={theme.colors.textMuted} size={18} />}
        containerStyle={styles.search}
      />

      {term.length >= 2 ? (
        <View>
          <SectionHeader
            title="Results"
            subtitle={
              results.length >= MAX_RESULTS
                ? `First ${MAX_RESULTS} — keep typing to narrow`
                : `${results.length} found`
            }
            style={styles.section}
          />
          {results.length === 0 ? (
            <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
              Nothing matches “{term}”.
            </Text>
          ) : (
            <View style={styles.list}>
              {results.map(e => (
                <ListRow
                  key={e.id}
                  filled
                  title={e.name}
                  subtitle={describe(e)}
                  onPress={() => navigation.navigate('ExerciseDetail', { id: e.id })}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View>
          <SectionHeader
            title="Body part"
            subtitle="Pick one and we'll build a session that fits your time"
            style={styles.section}
          />
          <View style={styles.grid}>
            {BODY_REGIONS.map(region => {
              const Icon = REGION_ICON[region];
              return (
              <PressableScale
                key={region}
                accessibilityRole="button"
                accessibilityLabel={`${REGION_LABEL[region]}, ${counts[region]} exercises`}
                style={styles.tileWrap}
                onPress={() => navigation.navigate('MuscleGroup', { region })}>
                <Card variant="light" padding="base" radius="xl">
                  <View style={styles.tileIcon}>
                    <Icon color={theme.colors.accent} size={20} />
                  </View>
                  <Text variant="bodyStrong">{REGION_LABEL[region]}</Text>
                  <Text variant="caption" tone="muted" style={styles.tileCount}>
                    {counts[region]} exercises
                  </Text>
                </Card>
              </PressableScale>
              );
            })}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 6 },
  search: { marginTop: 22 },
  section: { marginTop: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  // Two per row, accounting for the gap between them.
  tileWrap: { width: '48%' },
  tileIcon: { marginBottom: 10 },
  tileCount: { marginTop: 2 },
  list: { marginTop: 12, rowGap: 8 },
  empty: { marginTop: 24 },
});
