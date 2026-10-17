import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Play, Users } from 'lucide-react-native';

import {
  Button,
  Card,
  CityMap,
  Screen,
  SectionHeader,
  Text,
  type MapCell,
} from '../../components';
import { useSocial } from '../../hooks';
import { useCity } from '../../hooks/useCity';
import {
  CITY_WINDOW_DAYS,
  clubColour,
  runsToTake,
  stealLine,
  takeLine,
  type CellId,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme, useThemeContext } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Light up the city.
 *
 * The map answers one question — whose ground is this? — and every other
 * element on the screen turns the answer into a reason to run: a steal to
 * avenge, a block that is three runs from being yours, a club one block ahead.
 */
export function CityScreen() {
  const theme = useTheme();
  const { tone } = useThemeContext();
  const navigation = useNavigation<Nav>();
  const { height: screenH } = useWindowDimensions();

  const { groups } = useSocial();
  const clubs = useMemo(() => groups.filter(g => g.kind === 'club'), [groups]);
  const myClubIds = useMemo(() => clubs.map(c => c.id), [clubs]);
  const myClub = clubs[0] ?? null;

  const { centre, state, standings, steals, acknowledge, loading } = useCity(myClubIds);
  const [selected, setSelected] = useState<CellId | null>(null);

  // Leaving the screen counts as having seen the steals; they are not repeated.
  useFocusEffect(
    useCallback(() => () => acknowledge(), [acknowledge]),
  );

  const cells: MapCell[] = useMemo(() => {
    const mine = new Set(myClubIds);
    const out: MapCell[] = [];
    state.embers.forEach(cell => out.push({ cell, colour: '', kind: 'ember' }));
    state.owned.forEach(b =>
      out.push({
        cell: b.cell,
        colour: clubColour(b.clubId),
        kind: 'lit',
        mine: mine.has(b.clubId),
      }),
    );
    return out;
  }, [state, myClubIds]);

  const block = selected ? state.owned.get(selected) ?? null : null;
  const isEmber = selected ? state.embers.has(selected) : false;

  const run = () => navigation.navigate('Tracking', { kind: 'run' });

  const myBlocks = standings.find(s => myClubIds.includes(s.clubId))?.blocks ?? 0;
  const myRank = standings.findIndex(s => myClubIds.includes(s.clubId));
  const ahead = myRank > 0 ? standings[myRank - 1] : null;

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="label" tone="accent" uppercase>
          This week · last {CITY_WINDOW_DAYS} days
        </Text>
        <Text variant="h1" style={styles.title}>
          {myClub && myBlocks > 0
            ? `${myClub.name} holds ${myBlocks} block${myBlocks === 1 ? '' : 's'}`
            : 'Light up the city'}
        </Text>
        {ahead && myClub ? (
          <Text variant="bodySm" tone="muted" style={styles.sub}>
            {ahead.clubName} is {ahead.blocks - myBlocks} block
            {ahead.blocks - myBlocks === 1 ? '' : 's'} ahead of you.
          </Text>
        ) : (
          <Text variant="bodySm" tone="muted" style={styles.sub}>
            The club with the most runs through a block this week owns it.
          </Text>
        )}
      </View>

      {steals.length > 0 ? (
        <Card variant="accent" padding="base" radius="xl" style={styles.steal}>
          <View style={styles.row}>
            <Flame color={theme.colors.onAccent} size={20} />
            <Text variant="bodyStrong" tone="onAccent" style={styles.flex}>
              {stealLine(steals[0], tone === 'savage')}
            </Text>
          </View>
          <View style={[styles.row, styles.stealActions]}>
            <Button
              label="Show me"
              size="sm"
              variant="outline"
              onPress={() => setSelected(steals[0].cells[0])}
            />
            <Button label="Take it back" size="sm" variant="dark" onPress={run} />
          </View>
        </Card>
      ) : null}

      <CityMap
        centre={centre}
        cells={cells}
        selected={selected}
        onTapCell={c => setSelected(cur => (cur === c ? null : c))}
        height={Math.round(Math.min(520, Math.max(340, screenH * 0.5)))}
        style={[styles.map, { borderRadius: theme.radius.xxl }]}
      />

      {selected ? (
        <Card variant="dark" padding="base" radius="xl" style={styles.sheet}>
          {block ? (
            <>
              <View style={styles.row}>
                <View style={[styles.swatch, { backgroundColor: clubColour(block.clubId) }]} />
                <Text variant="bodyStrong" tone="inverse" style={styles.flex}>
                  {block.clubName}
                </Text>
              </View>
              <Text variant="body" tone="inverse" style={styles.sheetText}>
                {takeLine(block, myClub?.id ?? null)}
              </Text>
              {Object.keys(block.counts).length > 1 ? (
                <View style={styles.counts}>
                  {Object.entries(block.counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([clubId, n]) => (
                      <View key={clubId} style={styles.row}>
                        <View style={[styles.dot, { backgroundColor: clubColour(clubId) }]} />
                        <Text variant="bodySm" tone="inverseMuted" style={styles.flex}>
                          {clubId === block.clubId
                            ? block.clubName
                            : myClubIds.includes(clubId)
                            ? 'Your club'
                            : 'Another club'}
                        </Text>
                        <Text variant="bodySm" tone="inverse">
                          {n} run{n === 1 ? '' : 's'}
                        </Text>
                      </View>
                    ))}
                </View>
              ) : null}
              {myClub && runsToTake(block, myClub.id) > 0 ? (
                <Button
                  label="Run it"
                  size="md"
                  fullWidth
                  onPress={run}
                  iconLeft={<Play color={theme.colors.onAccent} size={16} />}
                  style={styles.sheetAction}
                />
              ) : null}
            </>
          ) : (
            <>
              <Text variant="bodyStrong" tone="inverse">
                {isEmber ? 'Burnt out' : 'Dark block'}
              </Text>
              <Text variant="body" tone="inverseMuted" style={styles.sheetText}>
                {isEmber
                  ? 'Somebody held this last week and let it go. One run through it lights it for your club.'
                  : 'Nobody has run here this week. The first club run through it takes it.'}
              </Text>
              {myClub ? (
                <Button
                  label="Claim it"
                  size="md"
                  fullWidth
                  onPress={run}
                  iconLeft={<Play color={theme.colors.onAccent} size={16} />}
                  style={styles.sheetAction}
                />
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {!myClub ? (
        <Card variant="light" padding="base" radius="xl" style={styles.sheet}>
          <View style={styles.row}>
            <Users color={theme.colors.accent} size={20} />
            <Text variant="bodyStrong" style={styles.flex}>
              Runs light blocks for your club
            </Text>
          </View>
          <Text variant="bodySm" tone="muted" style={styles.sub}>
            Join your run club with its code, or start one. Solo runs still count
            toward your own history.
          </Text>
          <Button
            label="Find my club"
            size="sm"
            variant="outline"
            onPress={() => navigation.navigate('Tabs', { screen: 'Squad' })}
            style={styles.sheetAction}
          />
        </Card>
      ) : null}

      <SectionHeader
        title="Who holds the city"
        subtitle={loading ? 'Loading the map…' : 'Blocks held this week'}
        style={styles.section}
      />
      {standings.length === 0 && !loading ? (
        <Card variant="light" padding="base" radius="xl">
          <Text variant="bodyStrong">Nobody has lit this part of the city yet</Text>
          <Text variant="bodySm" tone="muted" style={styles.sub}>
            Your next club run claims every block it passes through.
          </Text>
        </Card>
      ) : (
        <Card variant="light" padding="base" radius="xl">
          <View style={styles.standings}>
            {standings.slice(0, 8).map((s, i) => {
              const mine = myClubIds.includes(s.clubId);
              return (
                <View key={s.clubId} style={styles.row}>
                  <Text variant="bodyStrong" tone={mine ? 'accent' : 'muted'} style={styles.rank}>
                    {i + 1}
                  </Text>
                  <View style={[styles.dot, { backgroundColor: clubColour(s.clubId) }]} />
                  <Text variant={mine ? 'bodyStrong' : 'body'} style={styles.flex}>
                    {s.clubName}
                  </Text>
                  <Text variant="bodyStrong">{s.blocks}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  header: { paddingTop: 12 },
  title: { marginTop: 6 },
  sub: { marginTop: 4 },
  steal: { marginTop: 16 },
  stealActions: { marginTop: 12, columnGap: 10 },
  map: { marginTop: 16 },
  sheet: { marginTop: 14 },
  sheetText: { marginTop: 6 },
  sheetAction: { marginTop: 14 },
  counts: { marginTop: 12, rowGap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  flex: { flex: 1 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  section: { marginTop: 28 },
  standings: { rowGap: 12 },
  rank: { width: 18 },
});
