import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Copy, Swords, Trophy } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  MeterBar,
  Screen,
  SegmentedControl,
  Text,
} from '../../components';
import {
  INDIVIDUAL_CHALLENGES,
  SUBMISSIONS,
  TODAY,
  counts,
  effortPoints,
  feedSubmissions,
  groupById,
  groupContributions,
  memberById,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Tab = 'activity' | 'members' | 'challenges';

/** A single group: members, its activity, and its challenges. */
export function GroupDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
  const group = groupById(route.params.groupId);

  const [tab, setTab] = useState<Tab>('activity');

  const activity = useMemo(() => feedSubmissions(group.id).slice(0, 12), [group.id]);
  const contributions = useMemo(
    () => groupContributions(group, SUBMISSIONS, TODAY),
    [group],
  );
  const challenges = INDIVIDUAL_CHALLENGES.filter(c => c.groupId === group.id);

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
        <Chip label="Code" value={group.code} variant="muted" />
      </View>

      <Text variant="displaySm" style={styles.title}>
        {group.name}
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {group.memberIds.length} members
      </Text>

      {/* Today's Activity - Hero Section */}
      <Card variant="dark" padding="lg" style={styles.todayHero}>
        <View style={styles.todayHeader}>
          <Text variant="headingMd" tone="inverse">
            Today's logs
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {TODAY}
          </Text>
        </View>
        
        {activity.length === 0 ? (
          <View style={styles.todayEmpty}>
            <Trophy color={theme.colors.textInverseMuted} size={32} />
            <Text variant="body" tone="inverseMuted" style={styles.todayEmptyText}>
              Nothing logged yet today
            </Text>
          </View>
        ) : (
          <View style={styles.todayList}>
            {activity.slice(0, 3).map(s => {
              const m = memberById(s.memberId);
              return (
                <View key={s.id} style={styles.todayItem}>
                  <Avatar name={m.name} size="sm" />
                  <View style={styles.todayItemContent}>
                    <Text variant="bodyStrong" tone="inverse">
                      {m.name}
                    </Text>
                    <Text variant="caption" tone="inverseMuted">
                      {s.kind} · {effortPoints(s.effort)} pts
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          label="Start a challenge"
          size="md"
          onPress={() => navigation.navigate('CreateChallenge', { groupId: group.id })}
          iconLeft={<Swords color={theme.colors.onAccent} size={16} />}
        />
        <Button
          label="Invite"
          variant="outline"
          size="md"
          iconLeft={<Copy color={theme.colors.text} size={16} />}
        />
      </View>

      <SegmentedControl<Tab>
        segments={[
          { value: 'activity', label: 'Activity' },
          { value: 'members', label: 'Members' },
          { value: 'challenges', label: 'Challenges' },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />

      {tab === 'activity' ? (
        activity.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            body="When members submit workouts they'll show up here."
          />
        ) : (
          <View style={styles.list}>
            {activity.map(s => {
              const m = memberById(s.memberId);
              return (
                <ListRow
                  key={s.id}
                  title={m.name}
                  subtitle={`${s.kind} · ${s.day}${
                    s.status === 'pending' ? ' · awaiting approval' : ''
                  }`}
                  leading={<Avatar name={m.name} size="md" />}
                  trailing={
                    <Text
                      variant="statSm"
                      tone={counts(s) ? 'default' : 'muted'}>
                      {effortPoints(s.effort)}
                    </Text>
                  }
                />
              );
            })}
          </View>
        )
      ) : null}

      {tab === 'members' ? (
        <View style={styles.list}>
          {contributions.map(c => {
            const m = memberById(c.memberId);
            return (
              <ListRow
                key={c.memberId}
                title={m.name}
                subtitle={`${m.handle} · ${c.points} pts today`}
                leading={<Avatar name={m.name} size="md" />}
                trailing={
                  c.wasCapped ? <Chip label="Capped" variant="muted" /> : undefined
                }
              />
            );
          })}
        </View>
      ) : null}

      {tab === 'challenges' ? (
        challenges.length === 0 ? (
          <EmptyState
            title="No active challenges"
            body="Set one up and everyone in the group gets it on their home screen."
            icon={<Trophy color={theme.colors.textMuted} size={26} />}
            action={
              <Button
                label="Create challenge"
                onPress={() =>
                  navigation.navigate('CreateChallenge', { groupId: group.id })
                }
              />
            }
          />
        ) : (
          <View style={styles.list}>
            {challenges.map(c => {
              // Progress is the current user's completed workouts in range.
              const done = SUBMISSIONS.filter(
                s =>
                  s.groupId === group.id &&
                  s.day >= c.startDay &&
                  s.day <= c.endDay &&
                  counts(s) &&
                  s.effort.workouts > 0,
              ).length;
              const pct = Math.min(done / c.targetWorkouts, 1) * 100;
              return (
                <Card key={c.id} variant="light" padding="base" style={styles.challenge}>
                  <Text variant="bodyStrong">{c.title}</Text>
                  <Text variant="caption" tone="muted" style={styles.challengeMeta}>
                    {done} of {c.targetWorkouts} · ends {c.endDay}
                  </Text>
                  <MeterBar value={pct} style={styles.challengeBar} />
                </Card>
              );
            })}
          </View>
        )
      ) : null}
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
  todayEmptyText: { marginTop: 12, textAlign: 'center' },
  todayList: { rowGap: 12 },
  todayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  todayItemContent: { flex: 1 },
  actions: { flexDirection: 'row', columnGap: 10, marginTop: 20 },
  tabs: { marginTop: 24 },
  list: { marginTop: 12, rowGap: 4 },
  challenge: { marginBottom: 8 },
  challengeMeta: { marginTop: 4 },
  challengeBar: { marginTop: 12 },
});
