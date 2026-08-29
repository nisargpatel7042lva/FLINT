import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Compass, Footprints, MapPin } from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  ExploredMap,
  IconButton,
  MeterBar,
  Screen,
  SectionHeader,
  StatPill,
  Text,
} from '../../components';
import {
  areaKm2,
  frontier,
  loadExplored,
  nextRank,
  rankFor,
  type ExploredCells,
} from '../../services';
import { useTheme } from '../../theme';

/**
 * The map of ground you have covered.
 *
 * The headline is the RANK and the FRONTIER, not the area. Area rewards
 * whoever happens to live somewhere sprawling; the frontier says "there are 46
 * blocks you have never set foot in and they start at the end of your street",
 * which is a thing a person can act on this evening.
 */
export function ExploredScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [cells, setCells] = useState<ExploredCells>({});
  const [loading, setLoading] = useState(true);

  /*
   * Re-read on focus rather than once on mount: finishing a run writes to the
   * map, and coming back to this screen should show the ground just covered.
   */
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadExplored().then(next => {
        if (alive) {
          setCells(next);
          setLoading(false);
        }
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const count = Object.keys(cells).length;
  const rank = rankFor(count);
  const upcoming = nextRank(count);
  const edge = frontier(cells);

  const progress = upcoming
    ? ((count - rank.from) / (upcoming.from - rank.from)) * 100
    : 100;

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        {count > 0 ? <Chip label={rank.name} variant="accent" /> : null}
      </View>

      <Text variant="displaySm" style={styles.title}>
        Explored
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {count === 0
          ? 'Every run and walk you track fills in the ground you covered.'
          : rank.blurb}
      </Text>

      <ExploredMap cells={cells} height={260} style={styles.map} />

      {/* The legend carries the whole idea, so it is stated rather than implied. */}
      {count > 0 ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[styles.swatch, { backgroundColor: theme.colors.accentSoft }]}
            />
            <Text variant="caption" tone="muted">
              Covered
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                styles.swatchFrontier,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
            <Text variant="caption" tone="muted">
              Right on the edge
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.stats}>
        <StatPill value={count} label="Blocks" variant="light" size="sm" />
        <StatPill
          value={areaKm2(cells)}
          label="km²"
          variant="light"
          size="sm"
          icon={<MapPin color={theme.colors.accent} size={15} />}
        />
        <StatPill value={edge.length} label="On the edge" variant="accent" size="sm" />
      </View>

      {upcoming ? (
        <Card variant="dark" padding="lg" radius="xxl" style={styles.rankCard}>
          <View style={styles.rankRow}>
            <Compass color={theme.colors.textInverse} size={20} />
            <View style={styles.flex}>
              <Text variant="label" tone="inverseMuted" uppercase>
                Next
              </Text>
              <Text variant="h2" tone="inverse" style={styles.rankTitle}>
                {upcoming.name}
              </Text>
            </View>
          </View>
          <Text variant="bodySm" tone="inverseMuted" style={styles.rankBlurb}>
            {upcoming.from - count} more blocks. {upcoming.blurb}
          </Text>
          <MeterBar value={Math.max(progress, 2)} style={styles.rankBar} />
        </Card>
      ) : null}

      {!loading && count === 0 ? (
        <Button
          label="Track a walk"
          size="lg"
          fullWidth
          style={styles.cta}
          onPress={() => navigation.navigate('Tracking', { kind: 'walk' })}
          iconLeft={<Footprints color={theme.colors.onAccent} size={18} />}
        />
      ) : (
        <>
          <SectionHeader
            title="Go somewhere new"
            subtitle={`${edge.length} blocks sit right on the edge of what you've covered`}
            style={styles.section}
          />
          <Text variant="bodySm" tone="muted">
            The edge grows every time you reach it. Turn down a different street
            and it moves with you.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 6 },
  map: { marginTop: 22 },
  legend: { flexDirection: 'row', columnGap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  // Matches the frontier opacity used inside ExploredMap.
  swatchFrontier: { opacity: 0.35 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  rankCard: { marginTop: 24 },
  rankRow: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  rankTitle: { marginTop: 2 },
  rankBlurb: { marginTop: 14 },
  rankBar: { marginTop: 14 },
  section: { marginTop: 32 },
  cta: { marginTop: 26 },
});
