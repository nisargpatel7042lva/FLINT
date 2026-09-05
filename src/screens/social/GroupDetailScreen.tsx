import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Target } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  Text,
} from '../../components';
import { ACTIVITY_LABELS } from '../../services/types';
import type { Group, Submission, OneOnOneChallenge } from '../../services/types';
import { getLocalDay } from '../../services/challenges';
import { getGroup, getGroupSubmissions, getGroupChallenges } from '../../services/repository.challenges';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { currentUser } from '../../services/auth';

/** A single group: members and today's activity logs. */
export function GroupDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();

  const user = currentUser();
  const currentUserId = user?.uid ?? '';

  const [group, setGroup] = useState<Group | null>(null);
  const [todayLogs, setTodayLogs] = useState<Submission[]>([]);
  const [groupChallenges, setGroupChallenges] = useState<OneOnOneChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getLocalDay();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Load group
        const groupData = await getGroup(route.params.groupId);
        if (!cancelled && groupData) {
          setGroup(groupData);

          // Load today's submissions for this group
          const subs = await getGroupSubmissions(route.params.groupId);
          const todaySubs = subs.filter(s => s.day === today);
          if (!cancelled) {
            setTodayLogs(todaySubs);
          }

          // Load challenges for this group
          const challenges = await getGroupChallenges(route.params.groupId);
          if (!cancelled) {
            setGroupChallenges(challenges);
          }
        }
      } catch (error) {
        console.error('Error loading group:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route.params.groupId, today]);

  const handleLogToday = () => {
    // Priority: active challenges (most recently accepted), then pending
    const activeChallenges = groupChallenges
      .filter(c => c.status === 'active')
      .sort((a, b) => {
        const aTime = a.acceptedAt ? new Date(a.acceptedAt).getTime() : 0;
        const bTime = b.acceptedAt ? new Date(b.acceptedAt).getTime() : 0;
        return bTime - aTime; // Most recent first
      });

    if (activeChallenges.length > 0) {
      // Navigate to log for the most recently accepted active challenge
      navigation.navigate('ChallengeLog', { challengeId: activeChallenges[0].id });
      return;
    }

    // If no active, check for pending invites
    const pendingChallenges = groupChallenges.filter(c => c.status === 'pending');
    if (pendingChallenges.length > 0) {
      // Navigate to detail for the first pending challenge
      navigation.navigate('ChallengeDetail', { challengeId: pendingChallenges[0].id });
      return;
    }

    // If no challenges at all, do nothing (button should be disabled)
    // This case is handled by disabling the button below
  };

  const hasActiveOrPendingChallenge = groupChallenges.some(
    c => c.status === 'active' || c.status === 'pending'
  );

  if (loading) {
    return (
      <Screen padding="lg" center>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text variant="body" tone="muted" style={styles.loadingText}>
          Loading...
        </Text>
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen padding="lg" center>
        <Text variant="displaySm" style={styles.errorTitle}>
          Group not found
        </Text>
        <Button label="Go back" onPress={() => navigation.goBack()} style={styles.backButton} />
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
        {group.code && <Chip label="Code" value={group.code} variant="muted" />}
      </View>

      <Text variant="displaySm" style={styles.title}>
        {group.name}
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {group.memberIds.length} members
      </Text>

      {/* Today's Logs - Hero Section */}
      <Card variant="dark" padding="lg" style={styles.todayHero}>
        <View style={styles.todayHeader}>
          <Text variant="headingMd" tone="inverse">
            Today's logs
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {today}
          </Text>
        </View>

        {todayLogs.length === 0 ? (
          <View style={styles.todayEmpty}>
            <Target color={theme.colors.textInverseMuted} size={32} />
            <Text variant="body" tone="inverseMuted" style={styles.emptyTitle}>
              Nobody's logged yet.
            </Text>
            <Text variant="bodySm" tone="inverseMuted" style={styles.emptySubtitle}>
              First one in sets the pace.
            </Text>
          </View>
        ) : (
          <View style={styles.todayList}>
            {todayLogs.slice(0, 3).map(s => (
              <View key={s.id} style={styles.todayItem}>
                <Avatar name={s.memberId === currentUserId ? 'You' : s.memberId} size="sm" />
                <View style={styles.todayItemContent}>
                  <Text variant="bodyStrong" tone="inverse">
                    {s.memberId === currentUserId ? 'You' : s.memberId}
                  </Text>
                  <Text variant="caption" tone="inverseMuted">
                    {ACTIVITY_LABELS[s.kind]} · {s.day}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Sticky Log Today CTA */}
      {hasActiveOrPendingChallenge ? (
        <Button
          label="Log today"
          size="lg"
          fullWidth
          iconLeft={<Target color={theme.colors.onAccent} size={16} />}
          onPress={handleLogToday}
          style={styles.logTodayCta}
        />
      ) : (
        <Card variant="light" padding="base" style={styles.noChallengeCard}>
          <Text variant="bodyStrong" style={styles.noChallengeTitle}>
            No active challenge
          </Text>
          <Text variant="bodySm" tone="muted" style={styles.noChallengeBody}>
            Start one to begin logging.
          </Text>
        </Card>
      )}

      {/* Activity list below */}
      {todayLogs.length > 0 && (
        <View style={styles.activitySection}>
          <Text variant="headingMd" style={styles.activityTitle}>
            All logs today
          </Text>
          <View style={styles.list}>
            {todayLogs.map(s => (
              <ListRow
                key={s.id}
                title={s.memberId === currentUserId ? 'You' : s.memberId}
                subtitle={`${ACTIVITY_LABELS[s.kind]} · ${s.day}`}
                leading={<Avatar name={s.memberId === currentUserId ? 'You' : s.memberId} size="md" />}
                trailing={
                  <Chip
                    label={s.status === 'auto_verified' ? 'Logged' : 'Pending'}
                    variant={s.status === 'auto_verified' ? 'accent' : 'muted'}
                  />
                }
              />
            ))}
          </View>
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
    paddingTop: 4,
  },
  title: { marginTop: 20 },
  subtitle: { marginTop: 4 },
  todayHero: { marginTop: 24 },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  todayEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyTitle: { marginTop: 12, textAlign: 'center', fontSize: 16 },
  emptySubtitle: { marginTop: 4, textAlign: 'center' },
  todayList: { rowGap: 12 },
  todayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  todayItemContent: { flex: 1 },
  logTodayCta: { marginTop: 20 },
  noChallengeCard: { marginTop: 20 },
  noChallengeTitle: { textAlign: 'center' },
  noChallengeBody: { marginTop: 4, textAlign: 'center' },
  activitySection: { marginTop: 28 },
  activityTitle: { marginBottom: 12 },
  list: { rowGap: 4 },
});
