import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronRight, Flame, MapPin, Play, Radio, Users } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  IconButton,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import { useSocial } from '../../hooks';
import { useClubRuns } from '../../hooks/useClubRuns';
import { useCity } from '../../hooks/useCity';
import {
  formatDuration,
  formatPaceSec,
  getRecorderStatus,
  loadRuns,
  predict,
  predictionLine,
  stealLine,
  todayKey,
  weekStartKey,
  type RunRecord,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme, useThemeContext } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const greeting = (h: number) =>
  h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

/**
 * Home, for runners.
 *
 * Read top to bottom it answers: is a run going? how is my week? what is my
 * club doing? what did the city do while I was away? Every card ends in the
 * same place — the start button — because the only thing this screen is for
 * is the next run.
 */
export function RunHomeScreen() {
  const theme = useTheme();
  const { tone } = useThemeContext();
  const navigation = useNavigation<Nav>();
  const { uid, groups, nameFor, unreadPokes } = useSocial();

  const clubs = useMemo(() => groups.filter(g => g.kind === 'club'), [groups]);
  const club = clubs[0] ?? null;
  const { board, myRank } = useClubRuns(club?.id ?? '', uid);
  const { steals, standings } = useCity(clubs.map(c => c.id));

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runActive, setRunActive] = useState(false);

  // Refreshed on every visit: a run finished a minute ago belongs here now.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadRuns()
        .then(r => alive && setRuns(r))
        .catch(() => {});
      getRecorderStatus()
        .then(s => alive && setRunActive(s.active))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const weekStart = weekStartKey(todayKey());
  const week = runs.filter(r => r.day >= weekStart && r.kind === 'run');
  const weekKm = week.reduce((s, r) => s + r.distanceKm, 0);
  const prediction = useMemo(() => predict(runs, 'run'), [runs]);

  const myName = uid ? nameFor(uid) : '';
  const firstName = myName && myName !== 'Someone' ? myName.split(' ')[0] : '';

  const clubBlocks = club ? standings.find(s => s.clubId === club.id)?.blocks ?? 0 : 0;
  const ahead = myRank && myRank > 1 ? board[myRank - 2] : null;

  const run = () => navigation.navigate('Tracking', { kind: 'run' });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          style={styles.who}
          onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
          accessibilityRole="button"
          accessibilityLabel="Your profile">
          <Avatar name={firstName || undefined} size="md" ring />
          <View>
            <Text variant="caption" tone="muted">
              {greeting(new Date().getHours())}
            </Text>
            <Text variant="h3">{firstName || 'Runner'}</Text>
          </View>
        </Pressable>
        <IconButton
          accessibilityLabel={unreadPokes > 0 ? `${unreadPokes} new nudges` : 'Nudges'}
          variant={unreadPokes > 0 ? 'accent' : 'dark'}
          size="md"
          onPress={() => navigation.navigate('Notifications')}>
          <Bell color={unreadPokes > 0 ? theme.colors.onAccent : theme.colors.textInverse} size={18} />
        </IconButton>
      </View>

      {runActive ? (
        <Card variant="accent" padding="base" radius="xl" style={styles.card}>
          <Pressable style={styles.row} onPress={run} accessibilityRole="button">
            <Radio color={theme.colors.onAccent} size={20} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" tone="onAccent">
                Run in progress
              </Text>
              <Text variant="bodySm" tone="onAccent">
                Still recording. Tap to go back to it.
              </Text>
            </View>
            <ChevronRight color={theme.colors.onAccent} size={20} />
          </Pressable>
        </Card>
      ) : null}

      {/* The week, and the button. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.card}>
        <Text variant="label" tone="inverseMuted" uppercase>
          This week
        </Text>
        <View style={styles.headline}>
          <Text variant="displayLg" tone="inverse">
            {weekKm.toFixed(1)}
          </Text>
          <Text variant="h2" tone="inverseMuted" style={styles.unit}>
            km
          </Text>
        </View>
        <Text variant="bodySm" tone="inverseMuted">
          {week.length === 0
            ? 'No runs yet this week.'
            : `${week.length} run${week.length === 1 ? '' : 's'}${
                club && myRank ? ` · #${myRank} in ${club.name}` : ''
              }`}
        </Text>
        {ahead && club ? (
          <Text variant="bodySm" tone="inverse" style={styles.ahead}>
            {nameFor(ahead.uid)} is {(ahead.km - (board[(myRank ?? 1) - 1]?.km ?? 0)).toFixed(1)} km
            ahead of you.
          </Text>
        ) : null}

        <View style={styles.call}>
          <Text variant="label" tone="accent" uppercase>
            Our call
          </Text>
          <Text variant="body" tone="inverse" style={styles.callText}>
            {predictionLine(prediction, tone)}
          </Text>
        </View>

        <Button
          label="Start run"
          size="lg"
          fullWidth
          onPress={run}
          iconLeft={<Play color={theme.colors.onAccent} size={18} />}
          style={styles.start}
        />
      </Card>

      {steals.length > 0 ? (
        <Card variant="light" padding="base" radius="xl" style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('Tabs', { screen: 'City' })}
            accessibilityRole="button">
            <Flame color={theme.colors.accent} size={20} />
            <Text variant="bodyStrong" style={styles.flex}>
              {stealLine(steals[0], tone === 'savage')}
            </Text>
            <ChevronRight color={theme.colors.textMuted} size={20} />
          </Pressable>
        </Card>
      ) : null}

      {club ? (
        <>
          <SectionHeader
            title={club.name}
            subtitle={
              clubBlocks > 0
                ? `Holding ${clubBlocks} block${clubBlocks === 1 ? '' : 's'} this week`
                : 'This week’s distance'
            }
            actionLabel="Open"
            onActionPress={() => navigation.navigate('GroupDetail', { groupId: club.id })}
            style={styles.section}
          />
          <Card variant="light" padding="base" radius="xl">
            {board.length === 0 ? (
              <Text variant="bodySm" tone="muted">
                Nobody has run yet this week. First run puts you top of the board.
              </Text>
            ) : (
              <View style={styles.board}>
                {board.slice(0, 3).map((e, i) => (
                  <View key={e.uid} style={styles.row}>
                    <Text variant="bodyStrong" tone={e.uid === uid ? 'accent' : 'muted'} style={styles.rank}>
                      {i + 1}
                    </Text>
                    <Text variant={e.uid === uid ? 'bodyStrong' : 'body'} style={styles.flex}>
                      {e.uid === uid ? 'You' : nameFor(e.uid)}
                    </Text>
                    <Text variant="bodyStrong">{e.km.toFixed(1)} km</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      ) : (
        <Card variant="light" padding="base" radius="xl" style={styles.section}>
          <View style={styles.row}>
            <Users color={theme.colors.accent} size={20} />
            <Text variant="bodyStrong" style={styles.flex}>
              Run with a club
            </Text>
          </View>
          <Text variant="bodySm" tone="muted" style={styles.sub}>
            Club runs light up the city map. Join yours with its code, or start one.
          </Text>
          <Button
            label="Join or start a club"
            size="sm"
            variant="outline"
            onPress={() => navigation.navigate('JoinClub')}
            style={styles.sub}
          />
        </Card>
      )}

      <SectionHeader
        title="Recent runs"
        actionLabel={runs.length > 0 ? 'All' : undefined}
        onActionPress={() => navigation.navigate('History')}
        style={styles.section}
      />
      {runs.length === 0 ? (
        <Card variant="light" padding="base" radius="xl">
          <View style={styles.row}>
            <MapPin color={theme.colors.textMuted} size={18} />
            <Text variant="bodySm" tone="muted" style={styles.flex}>
              Your runs land here. Keep the phone in your pocket: Flint records with
              the screen off.
            </Text>
          </View>
        </Card>
      ) : (
        <Card variant="light" padding="base" radius="xl">
          <View style={styles.board}>
            {runs.slice(0, 3).map(r => (
              <View key={r.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">
                    {r.distanceKm.toFixed(2)} km {r.kind === 'walk' ? 'walk' : 'run'}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {new Date(r.startedAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Text variant="bodySm" tone="muted">
                  {formatDuration(r.durationSec)}
                  {r.distanceKm >= 0.5 ? ` · ${formatPaceSec(r.durationSec / r.distanceKm)}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </Card>
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
    paddingTop: 8,
  },
  who: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  card: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  flex: { flex: 1 },
  headline: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, marginTop: 4 },
  unit: { marginBottom: 4 },
  ahead: { marginTop: 6 },
  call: { marginTop: 20 },
  callText: { marginTop: 4 },
  start: { marginTop: 20 },
  section: { marginTop: 28 },
  sub: { marginTop: 8 },
  board: { rowGap: 12 },
  rank: { width: 18 },
});
