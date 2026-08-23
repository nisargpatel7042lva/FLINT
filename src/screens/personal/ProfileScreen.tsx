import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';

import {
  Avatar,
  Card,
  Char,
  Chip,
  ListRow,
  MeterBar,
  Screen,
  SectionHeader,
  StatPill,
  Text,
  charStateForStreak,
} from '../../components';
import { CHAR_STAGES, PROFILE, charStage } from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { useTheme } from '../../theme';

/** Personal profile: who you are, where Char is, and what you've built. */
export function ProfileScreen() {
  const theme = useTheme();

  const { streak, atRisk, best, stats, source } = useSessions();
  const { stage, next, progress, daysToNext } = useMemo(
    () => charStage(streak),
    [streak],
  );

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name={PROFILE.name} size="lg" ring />
        <View style={styles.flex}>
          <Text variant="h1" numberOfLines={1}>
            {PROFILE.name}
          </Text>
          <Text variant="bodySm" tone="muted" numberOfLines={1}>
            {PROFILE.handle}
          </Text>
        </View>
        {/* Which backend is live should never be a mystery in dev. */}
        <Chip
          label=""
          value={source === 'firestore' ? 'Firestore' : 'Local'}
          variant="muted"
        />
      </View>

      {/* Char's evolution stage. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.charCard}>
        <View style={styles.charRow}>
          <Char state={charStateForStreak(streak, { atRisk })} size={120} />
          <View style={styles.flex}>
            <Text variant="label" tone="inverseMuted" uppercase>
              Current stage
            </Text>
            <Text variant="h1" tone="inverse" style={styles.stageName}>
              {stage.name}
            </Text>
            <Text variant="bodySm" tone="inverseMuted" style={styles.stageBlurb}>
              {stage.blurb}
            </Text>
          </View>
        </View>

        {next ? (
          <View style={styles.nextBlock}>
            <View style={styles.nextRow}>
              <Text variant="caption" tone="inverseMuted">
                Next: {next.name}
              </Text>
              <Text variant="caption" tone="inverse">
                {daysToNext} {daysToNext === 1 ? 'day' : 'days'} to go
              </Text>
            </View>
            <MeterBar
              value={progress * 100}
              trackColor={theme.colors.surfaceInverseMuted}
            />
          </View>
        ) : (
          <Text variant="caption" tone="inverseMuted" style={styles.nextBlock}>
            Final stage reached.
          </Text>
        )}
      </Card>

      <SectionHeader
        title="Lifetime"
        subtitle={`Training since ${PROFILE.joinedDay}`}
        style={styles.section}
      />
      <View style={styles.stats}>
        <StatPill value={stats.totalSessions} label="Sessions" variant="light" size="sm" />
        <StatPill value={stats.totalMinutes} label="Minutes" variant="light" size="sm" />
        <StatPill value={stats.totalKcal} label="Kcal" variant="light" size="sm" />
      </View>

      <SectionHeader title="Streaks" style={styles.section} />
      <View style={styles.streakRow}>
        <Card variant="accent" padding="base" style={styles.streakCard}>
          <View style={styles.streakInner}>
            <Flame color={theme.colors.onAccent} size={22} />
            <Text variant="statMd" tone="onAccent">
              {streak}
            </Text>
          </View>
          <Text variant="label" tone="onAccent" uppercase>
            Current
          </Text>
        </Card>
        <Card variant="light" padding="base" style={styles.streakCard}>
          <View style={styles.streakInner}>
            <Flame color={theme.colors.accent} size={22} />
            <Text variant="statMd">{best}</Text>
          </View>
          <Text variant="label" tone="muted" uppercase>
            Longest
          </Text>
        </Card>
      </View>

      <SectionHeader
        title="All stages"
        subtitle="Driven by your current streak, so Char can fall back too"
        style={styles.section}
      />
      <View style={styles.stages}>
        {CHAR_STAGES.map(s => {
          const reached = streak >= s.minStreak;
          const isCurrent = s.id === stage.id;
          return (
            <ListRow
              key={s.id}
              title={s.name}
              subtitle={
                s.minStreak === 0 ? 'From day one' : `${s.minStreak}-day streak`
              }
              leading={
                <Char
                  state={reached ? 'glowing' : 'dim'}
                  size={40}
                />
              }
              trailing={
                isCurrent ? (
                  <Chip label="Now" variant="accent" />
                ) : reached ? (
                  <Chip label="Reached" variant="muted" />
                ) : undefined
              }
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
    paddingTop: 14,
  },
  charCard: { marginTop: 22 },
  charRow: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  stageName: { marginTop: 4 },
  stageBlurb: { marginTop: 6 },
  nextBlock: { marginTop: 20 },
  nextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  section: { marginTop: 30 },
  stats: { flexDirection: 'row', columnGap: 10, marginTop: 14 },
  streakRow: { flexDirection: 'row', columnGap: 12, marginTop: 14 },
  streakCard: { flex: 1 },
  streakInner: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  stages: { marginTop: 8 },
});
