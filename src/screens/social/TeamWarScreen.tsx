import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ShieldCheck, Video } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  ListRow,
  RaceTrack,
  RoundsStrip,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
  type RoundOutcome,
} from '../../components';
import {
  CURRENT_USER_ID,
  DAILY_MEMBER_CAP,
  SUBMISSIONS,
  TODAY,
  WAR,
  effortPoints,
  groupContributions,
  memberById,
  pendingForReview,
  pluralDays,
  warGroups,
  warStanding,
} from '../../services';
import { useTheme } from '../../theme';

type Tab = 'today' | 'rounds' | 'squad';

const weekday = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

/**
 * Team Wars scoreboard.
 *
 * Scoring model: unified points, per-member daily cap, daily rounds, opponent
 * verification. All of it lives in `services/scoring.ts` — this screen only
 * renders the standing.
 */
export function TeamWarScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('today');

  const groups = useMemo(() => warGroups(), []);
  const standing = useMemo(
    () => warStanding(WAR, groups, SUBMISSIONS, TODAY),
    [groups],
  );

  /** Index of the group the current user belongs to. */
  const myIndex = groups[0].memberIds.includes(CURRENT_USER_ID) ? 0 : 1;
  const them = myIndex === 0 ? 1 : 0;

  const lanes = groups.map((g, i) => ({
    id: g.id,
    label: g.name,
    score: standing.today.scores[i],
    pending: standing.today.pending[i],
    memberNames: g.memberIds.map(id => memberById(id).name),
  }));

  const todayDelta = standing.today.scores[myIndex] - standing.today.scores[them];

  const headline =
    todayDelta > 0
      ? `You lead today by ${todayDelta.toLocaleString()}`
      : todayDelta < 0
      ? `You're down ${Math.abs(todayDelta).toLocaleString()} today`
      : 'Dead level today';

  const rounds: { label: string; outcome: RoundOutcome }[] = WAR.days.map(day => {
    if (day > TODAY) {
      return { label: weekday(day), outcome: 'upcoming' as RoundOutcome };
    }
    if (day === TODAY) {
      return { label: weekday(day), outcome: 'live' as RoundOutcome };
    }
    const r = standing.rounds.find(x => x.day === day);
    if (!r || r.winner === null) {
      return { label: weekday(day), outcome: 'tie' as RoundOutcome };
    }
    return {
      label: weekday(day),
      outcome: (r.winner === myIndex ? 'win' : 'loss') as RoundOutcome,
    };
  });

  const contributions = useMemo(
    () => groupContributions(groups[myIndex], SUBMISSIONS, TODAY),
    [groups, myIndex],
  );

  const reviewQueue = useMemo(() => pendingForReview(), []);

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
        <Chip
          label="Round"
          value={`${pluralDays(standing.daysRemaining)} left`}
          variant="muted"
        />
      </View>

      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        Team War · Live
      </Text>
      <Text variant="displaySm" style={styles.headline}>
        {headline}
      </Text>

      {/* The race itself. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.raceCard}>
        <RaceTrack lanes={lanes} onDark />
        <Text variant="caption" tone="inverseMuted" style={styles.raceNote}>
          Faded bar = points waiting on opponent approval.
        </Text>
      </Card>

      {/* Days won — the war is decided on rounds, not cumulative points. */}
      <Card variant="light" padding="base" style={styles.roundsCard}>
        <View style={styles.roundsHead}>
          <Text variant="bodyStrong">Days won</Text>
          <Text variant="statSm" tone="accent">
            {standing.daysWon[myIndex]}–{standing.daysWon[them]}
          </Text>
        </View>
        <RoundsStrip rounds={rounds} style={styles.strip} />
      </Card>

      <SegmentedControl<Tab>
        segments={[
          { value: 'today', label: 'Today' },
          { value: 'rounds', label: 'Rounds' },
          { value: 'squad', label: 'Squad' },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />

      {tab === 'today' ? (
        <View>
          <SectionHeader
            title="Your squad today"
            subtitle={`Capped at ${DAILY_MEMBER_CAP} pts per member`}
          />
          <View style={styles.list}>
            {contributions.map(c => {
              const m = memberById(c.memberId);
              return (
                <ListRow
                  key={c.memberId}
                  title={m.name}
                  subtitle={
                    c.wasCapped
                      ? `${c.raw.toLocaleString()} pts → capped`
                      : c.pending > 0
                      ? `${c.pending.toLocaleString()} pts pending approval`
                      : m.handle
                  }
                  leading={<Avatar name={m.name} size="md" />}
                  trailing={
                    <Text variant="statSm" tone={c.points > 0 ? 'default' : 'muted'}>
                      {c.points}
                    </Text>
                  }
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {tab === 'rounds' ? (
        <View style={styles.list}>
          {standing.rounds.map(r => {
            const won = r.winner === myIndex;
            const tied = r.winner === null;
            return (
              <ListRow
                key={r.day}
                filled
                title={new Date(`${r.day}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                })}
                subtitle={`${r.scores[myIndex].toLocaleString()} — ${r.scores[
                  them
                ].toLocaleString()}`}
                trailing={
                  <Chip
                    label={tied ? 'Tie' : won ? 'Won' : 'Lost'}
                    variant={won ? 'accent' : 'muted'}
                  />
                }
              />
            );
          })}
        </View>
      ) : null}

      {tab === 'squad' ? (
        <View style={styles.list}>
          {groups[them].memberIds.map(id => {
            const m = memberById(id);
            return (
              <ListRow
                key={id}
                title={m.name}
                subtitle={`${groups[them].name} · ${m.handle}`}
                leading={<Avatar name={m.name} size="md" />}
              />
            );
          })}
        </View>
      ) : null}

      {/* Verification is a social mechanic: opponents approve each other. */}
      {reviewQueue.length > 0 ? (
        <Card variant="accent" padding="base" style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <ShieldCheck color={theme.colors.onAccent} size={22} />
            <View style={styles.reviewCopy}>
              <Text variant="bodyStrong" tone="onAccent">
                {reviewQueue.length} proofs need your review
              </Text>
              <Text variant="caption" tone="onAccent">
                {groups[them].name} can’t score until you verify.
              </Text>
            </View>
          </View>
          <Button
            label="Review proof"
            variant="dark"
            size="sm"
            fullWidth
            style={styles.reviewCta}
            onPress={() => navigation.navigate('ProofReview')}
          />
        </Card>
      ) : null}

      <Button
        label="Submit today’s proof"
        size="lg"
        fullWidth
        style={styles.submit}
        onPress={() => navigation.navigate('ProofSubmit', { warId: WAR.id })}
        iconLeft={<Video color={theme.colors.onAccent} size={20} />}
      />
      <Text variant="caption" tone="muted" align="center" style={styles.submitNote}>
        Team Wars require a short video. Top effort today:{' '}
        {effortPoints({ workouts: 1, distanceKm: 5, kcal: 400 })} pts for a workout + 5km.
      </Text>
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
  eyebrow: { marginTop: 20 },
  headline: { marginTop: 6 },
  raceCard: { marginTop: 20 },
  raceNote: { marginTop: 16 },
  roundsCard: { marginTop: 16 },
  roundsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strip: { marginTop: 14 },
  tabs: { marginTop: 24 },
  list: { marginTop: 8, rowGap: 4 },
  reviewCard: { marginTop: 24 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  reviewCopy: { flex: 1 },
  reviewCta: { marginTop: 14 },
  submit: { marginTop: 24 },
  submitNote: { marginTop: 10 },
});
