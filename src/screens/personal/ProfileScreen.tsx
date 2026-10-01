import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import {
  ChevronRight,
  Dumbbell,
  Flame,
  Palette,
  Timer,
  Trophy,
} from 'lucide-react-native';

import {
  Avatar,
  Card,
  Spark,
  Chip,
  ListRow,
  MeterBar,
  PhotoCard,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatPill,
  Text,
  sparkStateForStreak,
} from '../../components';
import {
  SPARK_STAGES,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  PLACE_LABEL,
  PROFILE,
  barrierById,
  barrierReminder,
  ensureSignedIn,
  sparkStage,
  syncTone,
  type Tone,
} from '../../services';
import { useSessions } from '../../hooks/useSessions';
import { useProfile } from '../../hooks';
import { placeholderPhoto, remote } from '../../assets/placeholders';
import { useTheme, useThemeContext } from '../../theme';

/**
 * Personal profile: who you are, where Spark is, and what you've built.
 *
 * Follows the reference's layered treatment — a photo cover with the avatar
 * breaking out over its lower edge. Spark's own card stays dark on purpose: it
 * is a glowing ember, and it needs a dark ground to read as lit rather than as
 * an orange blob on a photograph.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const { streak, atRisk, best, stats, source } = useSessions();
  const { profile } = useProfile();
  const { tone, setTone } = useThemeContext();

  /*
   * Savage mode. Stored on the device, mirrored to the account so the server's
   * pushes match. Best effort on the mirror: if it fails the pushes stay warm,
   * which is the safe way to be wrong.
   */
  const chooseTone = (next: Tone) => {
    setTone(next);
    ensureSignedIn()
      .then(u => syncTone(u.uid, next))
      .catch(() => {});
  };
  const { stage, next, progress, daysToNext } = useMemo(
    () => sparkStage(streak),
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

      {/* Spark's evolution stage. Dark ground so the ember reads as lit. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.charCard}>
        <View style={styles.charRow}>
          <Spark state={sparkStateForStreak(streak, { atRisk })} size={110} />
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

      {/*
        Why this person started, in their own words from the first screen.
        A streak explains what somebody has done; this explains what it is for,
        and it is the only thing on this screen that will still mean something
        on the day they consider stopping.
      */}
      {profile.barrier ? (
        <Card variant="light" padding="base" radius="xl" style={styles.why}>
          <Text variant="label" tone="muted" uppercase>
            Why you started
          </Text>
          <Text variant="bodyStrong" style={styles.whyTitle}>
            {barrierById(profile.barrier).title}
          </Text>
          <Text variant="bodySm" tone="muted" style={styles.whyBlurb}>
            {barrierReminder(profile.barrier)}
          </Text>
        </Card>
      ) : null}

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

      <SectionHeader title="Settings" style={styles.section} />
      <ListRow
        filled
        title="Training"
        subtitle={`${PLACE_LABEL[profile.place]} · ${EXPERIENCE_LABEL[
          profile.experience
        ].toLowerCase()} · ${GOAL_LABEL[profile.goal].toLowerCase()}`}
        leading={<Dumbbell color={theme.colors.accent} size={20} />}
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('TrainingPreferences')}
        style={styles.settingsRow}
      />
      <ListRow
        filled
        title="Appearance"
        subtitle="Theme, accent colour and the walkthrough"
        leading={<Palette color={theme.colors.accent} size={20} />}
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('Appearance')}
        style={styles.settingsRow}
      />

      {/*
        How hard the app pushes back. Opt-in by design: savage is something a
        person asks for, never something they are dropped into. The examples
        are real lines from each voice, so the choice is made knowing exactly
        what it means.
      */}
      <SectionHeader
        title="How hard should we push?"
        subtitle="Predictions, overtakes and your rival's excuses"
        style={styles.section}
      />
      <SegmentedControl<Tone>
        segments={[
          { value: 'warm', label: 'Push me' },
          { value: 'savage', label: 'Savage' },
        ]}
        value={tone}
        onChange={chooseTone}
        style={styles.toneControl}
      />
      <Text variant="bodySm" tone="muted" style={styles.toneExample}>
        {tone === 'savage'
          ? '“Your last 6 runs say you stop before 5 km. Prove us wrong.” Never about your body, always about the work.'
          : '“Your last 6 runs put your limit around 5 km today. Go past it.”'}
      </Text>

      <SectionHeader
        title="All stages"
        subtitle="Driven by your current streak, so your spark can fall back too"
        style={styles.section}
      />
      <View style={styles.stages}>
        {SPARK_STAGES.map(s => {
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
              leading={<Spark state={reached ? 'glowing' : 'dim'} size={40} />}
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
  why: { marginTop: 20 },
  toneControl: { marginTop: 8 },
  toneExample: { marginTop: 8 },
  whyTitle: { marginTop: 8 },
  whyBlurb: { marginTop: 4 },
  section: { marginTop: 30 },
  stats: { flexDirection: 'row', columnGap: 10, marginTop: 14 },
  stages: { marginTop: 10, rowGap: 8 },
  settingsRow: { marginTop: 12 },
});
