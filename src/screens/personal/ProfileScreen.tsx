import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Flame, Timer, Trophy } from 'lucide-react-native';

import {
  Avatar,
  Card,
  Char,
  Chip,
  ListRow,
  MeterBar,
  PhotoCard,
  Screen,
  SectionHeader,
  StatPill,
  Text,
  charStateForStreak,
} from '../../components';
import { CHAR_STAGES, PROFILE, charStage } from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { placeholderPhoto, remote } from '../../assets/placeholders';
import { ThemeScope, useTheme } from '../../theme';

/**
 * Personal profile: who you are, where Char is, and what you've built.
 *
 * Follows the reference's layered treatment — a photo cover with the avatar
 * breaking out over its lower edge. Char's own card stays dark on purpose: it
 * is a glowing ember, and it needs a dark ground to read as lit rather than as
 * an orange blob on a photograph.
 */
/** Light-mode screen, per the reference's cream pages. */
export function ProfileScreen() {
  return (
    <ThemeScope mode="light">
      <ProfileContent />
    </ThemeScope>
  );
}

function ProfileContent() {
  const theme = useTheme();

  const { streak, atRisk, best, stats, source } = useSessions();
  const { stage, next, progress, daysToNext } = useMemo(
    () => charStage(streak),
    [streak],
  );

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      {/* Cover photo. The avatar below overlaps its lower edge. */}
      <PhotoCard
        source={remote(placeholderPhoto('strength', 'profile-cover', 900, 420))}
        height={140}
        layout="spread"
        padding="base"
        scrim={0.35}
        style={styles.cover}>
        <View style={styles.coverTop}>
          <Chip label="" value={stage.name} variant="accent" />
          <Chip
            label=""
            value={source === 'firestore' ? 'Firestore' : 'Local'}
            variant="dark"
          />
        </View>
        <View />
      </PhotoCard>

      <View style={styles.identity}>
        <Avatar name={PROFILE.name} size="xl" ring style={styles.avatar} />
        <View style={styles.identityText}>
          <Text variant="h1" numberOfLines={1}>
            {PROFILE.name}
          </Text>
          <Text variant="bodySm" tone="muted" numberOfLines={1}>
            {PROFILE.handle} · since {PROFILE.joinedDay}
          </Text>
        </View>
      </View>

      {/* Char's evolution stage. Dark ground so the ember reads as lit. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.charCard}>
        <View style={styles.charRow}>
          <Char state={charStateForStreak(streak, { atRisk })} size={110} />
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

      {/* Streaks, given the weight they carry in this product. */}
      <View style={styles.streakRow}>
        <Card variant="accent" padding="base" style={styles.streakCard}>
          <View style={styles.streakInner}>
            <Flame color={theme.colors.onAccent} size={22} />
            <Text variant="statMd" tone="onAccent">
              {streak}
            </Text>
          </View>
          <Text variant="label" tone="onAccent" uppercase>
            Current streak
          </Text>
        </Card>
        <Card variant="light" padding="base" style={styles.streakCard}>
          <View style={styles.streakInner}>
            <Trophy color={theme.colors.accent} size={22} />
            <Text variant="statMd">{best}</Text>
          </View>
          <Text variant="label" tone="muted" uppercase>
            Longest ever
          </Text>
        </Card>
      </View>

      <SectionHeader
        title="Lifetime"
        subtitle={`Training since ${PROFILE.joinedDay}`}
        style={styles.section}
      />
      <View style={styles.stats}>
        <StatPill
          value={stats.totalSessions}
          label="Sessions"
          variant="light"
          size="sm"
        />
        <StatPill
          value={stats.totalMinutes}
          label="Minutes"
          variant="light"
          size="sm"
          icon={<Timer color={theme.colors.accent} size={15} />}
        />
        <StatPill value={stats.totalKcal} label="Kcal" variant="light" size="sm" />
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
              filled
              title={s.name}
              subtitle={
                s.minStreak === 0 ? 'From day one' : `${s.minStreak}-day streak`
              }
              leading={<Char state={reached ? 'glowing' : 'dim'} size={40} />}
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
  content: { paddingBottom: 160 },
  flex: { flex: 1 },
  cover: { marginTop: 14 },
  coverTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 14,
    // Pulls the avatar up so it breaks over the cover's lower edge.
    marginTop: -46,
    paddingLeft: 4,
  },
  avatar: {},
  identityText: { flex: 1, paddingBottom: 6 },
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
  streakRow: { flexDirection: 'row', columnGap: 12, marginTop: 16 },
  streakCard: { flex: 1 },
  streakInner: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  section: { marginTop: 30 },
  stats: { flexDirection: 'row', columnGap: 10, marginTop: 14 },
  stages: { marginTop: 10, rowGap: 8 },
});
