import React, { useMemo } from 'react';
import { StyleSheet, View, Share } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Flame, Link2, Target } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  ListRow,
  Screen,
  SegmentedControl,
  StatPill,
  Text,
  EmptyState,
} from '../../components';
import { ACTIVITY_LABELS, type Submission } from '../../services/types';
import {
  computeChallengeStreak,
  getTodaySubmissions,
  hasLoggedToday,
  isChallengeComplete,
  getLocalDay,
} from '../../services/challenges';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

// Mock data - will be replaced with Firebase
const MOCK_CHALLENGE = {
  id: 'ch1',
  type: 'one_on_one' as const,
  title: '30-day Run Challenge',
  inviteToken: 'ABC123XY',
  activityKind: 'run' as const,
  creatorId: 'u1',
  opponentId: 'u2',
  groupId: 'g1',
  targetDays: 30,
  sessionsPerDay: 1,
  status: 'active' as const,
  createdAt: '2026-09-01T00:00:00Z',
  acceptedAt: '2026-09-01T12:00:00Z',
  startDay: '2026-09-01',
  endDay: '2026-09-30',
};

const MOCK_SUBMISSIONS: Submission[] = [];
const MOCK_CURRENT_USER_ID = 'u1';

type Tab = 'today' | 'streak';

/**
 * Challenge detail screen: streaks, today's logs, and rematch CTA.
 * The log is the hero on this screen.
 */
export function ChallengeDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ChallengeDetail'>>();

  const [tab, setTab] = React.useState<Tab>('today');

  // TODO: Load from Firebase
  const challenge = MOCK_CHALLENGE;
  const submissions = MOCK_SUBMISSIONS;
  const currentUserId = MOCK_CURRENT_USER_ID;

  const today = getLocalDay();
  const todayLogs = useMemo(
    () => getTodaySubmissions(submissions, challenge.groupId!, today),
    [submissions, challenge.groupId, today],
  );

  const myStreak = useMemo(
    () => computeChallengeStreak(submissions, challenge.id, currentUserId, today),
    [submissions, challenge.id, currentUserId, today],
  );

  const opponentStreak = useMemo(
    () =>
      challenge.opponentId
        ? computeChallengeStreak(submissions, challenge.id, challenge.opponentId, today)
        : undefined,
    [submissions, challenge.id, challenge.opponentId, today],
  );

  const isComplete = isChallengeComplete(challenge, myStreak, opponentStreak);
  const hasLoggedTodayFlag = hasLoggedToday(submissions, challenge.id, currentUserId, today);

  const shareInvite = async () => {
    const inviteUrl = `https://flint.app/invite/${challenge.inviteToken}`;
    try {
      await Share.share({
        message: `Join my ${challenge.targetDays}-day ${
          ACTIVITY_LABELS[challenge.activityKind]
        } challenge on Flint! ${inviteUrl}`,
        url: inviteUrl,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRematch = () => {
    // TODO: Create rematch challenge
    console.log('Creating rematch...');
  };

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
        
        {challenge.status === 'pending' && (
          <Button
            label="Share invite"
            size="sm"
            variant="outline"
            iconLeft={<Link2 color={theme.colors.text} size={14} />}
            onPress={shareInvite}
          />
        )}
      </View>

      <Text variant="displaySm" style={styles.title}>
        {challenge.title}
      </Text>
      <View style={styles.meta}>
        <Chip
          label={ACTIVITY_LABELS[challenge.activityKind]}
          variant="accent"
        />
        <Chip
          label={`${challenge.targetDays} days`}
          variant="muted"
        />
        <Chip
          label={challenge.status}
          variant={challenge.status === 'active' ? 'accent' : 'muted'}
        />
      </View>

      {/* Streak Cards */}
      <View style={styles.streaks}>
        <Card variant="dark" padding="base" style={styles.streakCard}>
          <View style={styles.streakHeader}>
            <Text variant="bodySm" tone="inverseMuted">
              Your streak
            </Text>
            <Flame color={theme.colors.accent} size={16} />
          </View>
          <Text variant="displayLg" tone="inverse" style={styles.streakValue}>
            {myStreak.currentStreak}
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {myStreak.totalActiveDays} / {challenge.targetDays} days logged
          </Text>
        </Card>

        {opponentStreak && (
          <Card variant="light" padding="base" style={styles.streakCard}>
            <View style={styles.streakHeader}>
              <Text variant="bodySm" tone="muted">
                Their streak
              </Text>
              <Flame color={theme.colors.textMuted} size={16} />
            </View>
            <Text variant="displayLg" style={styles.streakValue}>
              {opponentStreak.currentStreak}
            </Text>
            <Text variant="caption" tone="muted">
              {opponentStreak.totalActiveDays} / {challenge.targetDays} days logged
            </Text>
          </Card>
        )}
      </View>

      {/* Log CTA - Hero of the screen */}
      {!isComplete && !hasLoggedTodayFlag && (
        <Card variant="accent" padding="base" style={styles.logCta}>
          <View style={styles.logCtaContent}>
            <Target color={theme.colors.onAccent} size={24} />
            <View style={styles.logCtaText}>
              <Text variant="bodyStrong" tone="inverse">
                Log today's {ACTIVITY_LABELS[challenge.activityKind]}
              </Text>
              <Text variant="bodySm" tone="inverseMuted">
                Keep your streak alive
              </Text>
            </View>
          </View>
          <Button
            label="Log activity"
            size="md"
            variant="inverse"
            onPress={() =>
              navigation.navigate('ChallengeLog', { challengeId: challenge.id })
            }
          />
        </Card>
      )}

      {/* Completed - Rematch CTA */}
      {isComplete && (
        <Card variant="dark" padding="lg" style={styles.completeCta}>
          <Text variant="headingLg" tone="inverse" style={styles.completeTitle}>
            Challenge complete!
          </Text>
          <Text variant="body" tone="inverseMuted" style={styles.completeBody}>
            You both showed up. Ready to push harder?
          </Text>
          <Button
            label="Push harder (same pair)"
            size="lg"
            fullWidth
            onPress={handleRematch}
            style={styles.rematchButton}
          />
        </Card>
      )}

      {/* Tabs */}
      <SegmentedControl<Tab>
        segments={[
          { value: 'today', label: "Today's logs" },
          { value: 'streak', label: 'Streak history' },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />

      {tab === 'today' ? (
        todayLogs.length === 0 ? (
          <EmptyState
            title="Nothing logged today"
            body="When you or your partner logs, it'll show here."
          />
        ) : (
          <View style={styles.list}>
            {todayLogs.map(log => (
              <ListRow
                key={log.id}
                title={log.memberId === currentUserId ? 'You' : 'Partner'}
                subtitle={`${ACTIVITY_LABELS[log.kind]} · ${log.day}`}
                leading={<Avatar name={log.memberId} size="md" />}
                trailing={
                  <Chip
                    label={log.status === 'auto_verified' ? 'Logged' : 'Pending'}
                    variant={log.status === 'auto_verified' ? 'accent' : 'muted'}
                  />
                }
              />
            ))}
          </View>
        )
      ) : (
        <View style={styles.streakStats}>
          <StatPill label="Best streak" value={`${myStreak.bestStreak} days`} />
          <StatPill
            label="Current streak"
            value={`${myStreak.currentStreak} days`}
          />
          <StatPill
            label="Active days"
            value={`${myStreak.totalActiveDays} days`}
          />
        </View>
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
  },
  title: { marginTop: 20 },
  meta: { flexDirection: 'row', columnGap: 8, marginTop: 12 },
  streaks: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  streakCard: { flex: 1 },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakValue: { marginTop: 12 },
  logCta: { marginTop: 20 },
  logCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginBottom: 16,
  },
  logCtaText: { flex: 1 },
  completeCta: { marginTop: 20 },
  completeTitle: { textAlign: 'center' },
  completeBody: { marginTop: 8, textAlign: 'center' },
  rematchButton: { marginTop: 20 },
  tabs: { marginTop: 24 },
  list: { marginTop: 12, rowGap: 4 },
  streakStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
});
