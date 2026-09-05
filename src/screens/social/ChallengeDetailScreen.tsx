import React, { useMemo } from 'react';
import { StyleSheet, View, Share, ActivityIndicator, Alert } from 'react-native';
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
import { ACTIVITY_LABELS } from '../../services/types';
import {
  getTodaySubmissions,
  hasLoggedToday,
  isChallengeComplete,
  getLocalDay,
} from '../../services/challenges';
import {
  useChallenge,
  useChallengeSubmissions,
  useChallengeStreaks,
  useRematchChallenge,
} from '../../hooks/useChallenges';
import { currentUser } from '../../services/auth';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

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

  const user = currentUser();
  const currentUserId = user?.uid ?? '';

  const { challenge, loading: loadingChallenge } = useChallenge(route.params.challengeId);
  const { submissions, loading: loadingSubmissions, reload: reloadSubmissions } = useChallengeSubmissions(route.params.challengeId);
  const { myStreak, opponentStreak, loading: loadingStreaks, reload: reloadStreaks } = useChallengeStreaks(challenge);
  const { rematch, creating: creatingRematch } = useRematchChallenge();

  const today = getLocalDay();
  
  const todayLogs = useMemo(
    () => challenge?.groupId ? getTodaySubmissions(submissions, challenge.groupId, today) : [],
    [submissions, challenge?.groupId, today],
  );

  const isComplete = useMemo(
    () => challenge && myStreak ? isChallengeComplete(challenge, myStreak, opponentStreak ?? undefined) : false,
    [challenge, myStreak, opponentStreak],
  );

  const completionStatus = useMemo(() => {
    if (!isComplete || !myStreak || !opponentStreak) return null;
    
    const myDays = myStreak.totalActiveDays;
    const theirDays = opponentStreak.totalActiveDays;
    
    if (myDays > theirDays) return 'won';
    if (theirDays > myDays) return 'lost';
    return 'tie';
  }, [isComplete, myStreak, opponentStreak]);
  
  const hasLoggedTodayFlag = useMemo(
    () => challenge ? hasLoggedToday(submissions, challenge.id, currentUserId, today) : false,
    [submissions, challenge, currentUserId, today],
  );

  const shareInvite = async () => {
    if (!challenge) return;
    const inviteUrl = `flint://invite/${challenge.inviteToken}`;
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

  const handleRematch = async () => {
    if (!challenge) return;
    
    try {
      const newChallenge = await rematch(challenge);
      Alert.alert(
        'Rematch Created!',
        `New ${newChallenge.targetDays}-day challenge is ready.`,
        [
          {
            text: 'View Challenge',
            onPress: () => navigation.replace('ChallengeDetail', { challengeId: newChallenge.id }),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not create rematch',
      );
    }
  };

  const handleLogPress = () => {
    if (challenge) {
      navigation.navigate('ChallengeLog', { challengeId: challenge.id });
    }
  };

  // Loading state
  if (loadingChallenge || loadingStreaks) {
    return (
      <Screen padding="lg" center>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text variant="body" tone="muted" style={styles.loadingText}>
          Loading challenge...
        </Text>
      </Screen>
    );
  }

  // Error state
  if (!challenge) {
    return (
      <Screen padding="lg" center>
        <Text variant="displaySm" style={styles.errorTitle}>
          Challenge not found
        </Text>
        <Button
          label="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </Screen>
    );
  }

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
            {myStreak?.currentStreak ?? 0}
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {myStreak?.totalActiveDays ?? 0} / {challenge.targetDays} days logged
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

      {/* Broken Streak - show if user had logged before but streak is now 0 */}
      {!isComplete && myStreak && myStreak.currentStreak === 0 && myStreak.totalActiveDays > 0 && (
        <Card variant="light" padding="base" style={styles.brokenStreakCard}>
          <Text variant="bodyStrong" tone="danger">
            Streak broke
          </Text>
          <Text variant="bodySm" tone="muted" style={styles.brokenStreakBody}>
            Log today to start again.
          </Text>
          <Button
            label="Log today"
            size="md"
            onPress={handleLogPress}
            style={styles.brokenStreakCta}
          />
        </Card>
      )}

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
                Keep it going
              </Text>
            </View>
          </View>
          <Button
            label="Log today"
            size="md"
            variant="inverse"
            onPress={handleLogPress}
          />
        </Card>
      )}

      {/* Done for today */}
      {!isComplete && hasLoggedTodayFlag && (
        <Card variant="light" padding="base" style={styles.doneCta}>
          <Text variant="bodyStrong">
            Done for now
          </Text>
          <Text variant="bodySm" tone="muted" style={styles.doneBody}>
            You've logged today. See you tomorrow.
          </Text>
        </Card>
      )}

      {/* Completed - Rematch CTA */}
      {isComplete && (
        <Card variant="dark" padding="lg" style={styles.completeCta}>
          <Text variant="headingLg" tone="inverse" style={styles.completeTitle}>
            {completionStatus === 'won' && 'You took it.'}
            {completionStatus === 'lost' && 'They edged you.'}
            {completionStatus === 'tie' && 'Even. Rematch decides.'}
            {!completionStatus && 'Challenge complete!'}
          </Text>
          <Button
            label="Push harder (same pair)"
            size="lg"
            fullWidth
            loading={creatingRematch}
            disabled={creatingRematch}
            onPress={handleRematch}
            style={styles.rematchButton}
          />
          <Button
            label="Done for now"
            size="lg"
            variant="ghost"
            fullWidth
            disabled={creatingRematch}
            onPress={() => navigation.goBack()}
            style={styles.doneButton}
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
            title="No logs yet"
            body="Waiting on you both."
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
          <StatPill label="Best streak" value={`${myStreak?.bestStreak ?? 0} days`} />
          <StatPill
            label="Current streak"
            value={`${myStreak?.currentStreak ?? 0} days`}
          />
          <StatPill
            label="Active days"
            value={`${myStreak?.totalActiveDays ?? 0} days`}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  loadingText: { marginTop: 16, textAlign: 'center' },
  errorTitle: { textAlign: 'center' },
  backButton: { marginTop: 20 },
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
  brokenStreakCard: { marginTop: 12 },
  brokenStreakBody: { marginTop: 4 },
  brokenStreakCta: { marginTop: 12 },
  logCta: { marginTop: 20 },
  logCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    marginBottom: 16,
  },
  logCtaText: { flex: 1 },
  doneCta: { marginTop: 20 },
  doneBody: { marginTop: 4 },
  completeCta: { marginTop: 20 },
  completeTitle: { textAlign: 'center' },
  rematchButton: { marginTop: 20 },
  doneButton: { marginTop: 8 },
  tabs: { marginTop: 24 },
  list: { marginTop: 12, rowGap: 4 },
  streakStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
});
