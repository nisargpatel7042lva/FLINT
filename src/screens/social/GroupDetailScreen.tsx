import React, { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import {
  ArrowLeft,
  Hand,
  LogOut,
  Share2,
  Swords,
  Trophy,
  UserPlus,
} from 'lucide-react-native';

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
  SectionHeader,
  SegmentedControl,
  Text,
} from '../../components';
import {
  CURRENT_USER_ID,
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
import { useSocial } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Tab = 'activity' | 'members' | 'challenges';

/** A single group: members, its activity, and its challenges. */
export function GroupDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();

  const {
    groupById: fromStore,
    friends,
    sendPoke,
    spent,
    uid,
    addToGroup,
    removeFromGroup,
    leaveGroup,
  } = useSocial();
  const [tab, setTab] = useState<Tab>('activity');

  /*
   * Real groups first, fixtures second.
   *
   * A group the user created or joined comes from the repository, and the
   * fixture lookup silently falls back to the first seed group rather than
   * failing — so checking the real list first is what stops a brand-new squad
   * from rendering as somebody else's.
   */
  const group = fromStore(route.params.groupId) ?? groupById(route.params.groupId);

  const activity = useMemo(() => feedSubmissions(group.id).slice(0, 12), [group.id]);
  const contributions = useMemo(
    () => groupContributions(group, SUBMISSIONS, TODAY),
    [group],
  );
  const challenges = INDIVIDUAL_CHALLENGES.filter(c => c.groupId === group.id);

  /**
   * Friends who are not in this group yet — the pool the invite list offers.
   *
   * Group membership is still device-local, so a member is only nudgeable when
   * they are also one of your friends, i.e. someone with a real account behind
   * them. Everyone else gets no button rather than a button that fails.
   */
  const addable = friends.filter(f => !group.memberIds.includes(f.uid));
  /** Only the person who made the group may change who is in it. */
  const isOwner = group.ownerUid === uid;
  const friendFor = (memberId: string) => friends.find(f => f.uid === memberId);

  const invite = () => {
    Share.share({
      message: `Join my group "${group.name}" on Flint. Code: ${group.code}`,
    }).catch(() => {
      // A dismissed share sheet rejects on some Android builds. Nothing to
      // recover from — the user simply chose not to send it.
    });
  };

  const leave = async () => {
    /*
     * Navigate first, then write.
     *
     * The moment the write lands this user is no longer a member, so the group
     * stops being readable and this screen would be rendering a group it can no
     * longer see. Leaving the screen before that happens is not a race being
     * papered over — it is the correct order.
     */
    navigation.goBack();
    await leaveGroup(group.id).catch(() => {});
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
        <Chip label="Code" value={group.code} variant="muted" />
      </View>

      <Text variant="displaySm" style={styles.title}>
        {group.name}
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
      </Text>

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
          onPress={invite}
          iconLeft={<Share2 color={theme.colors.text} size={16} />}
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
        <View>
          <View style={styles.list}>
            {contributions.map(c => {
              const m = memberById(c.memberId);
              const isMe = c.memberId === CURRENT_USER_ID;
              const friend = friendFor(c.memberId);
              const nudged = friend ? spent(friend.uid, 'poke') : false;
              return (
                <ListRow
                  key={c.memberId}
                  title={isMe ? `${m.name} (you)` : m.name}
                  subtitle={`${m.handle} · ${c.points} pts today`}
                  leading={<Avatar name={m.name} size="md" />}
                  trailing={
                    isMe ? (
                      c.wasCapped ? (
                        <Chip label="Capped" variant="muted" />
                      ) : undefined
                    ) : friend ? (
                      <Button
                        label={nudged ? 'Nudged' : 'Nudge'}
                        size="sm"
                        variant={nudged ? 'ghost' : 'outline'}
                        disabled={nudged}
                        onPress={() => sendPoke(friend, 'poke', group.id)}
                        iconLeft={
                          <Hand
                            color={nudged ? theme.colors.textMuted : theme.colors.text}
                            size={14}
                          />
                        }
                      />
                    ) : isOwner ? (
                      /*
                        Shown only to the owner, and only for people who are not
                        friends — a friend gets the nudge button, which is the
                        more useful of the two. Removing somebody is the last
                        resort, so it never outranks encouraging them.
                      */
                      <Button
                        label="Remove"
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          removeFromGroup(group.id, c.memberId).catch(() => {})
                        }
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </View>

          <SectionHeader
            title="Add friends"
            subtitle={
              isOwner
                ? 'They join straight away — no invite to accept'
                : 'Only the group’s owner can add people'
            }
            style={styles.section}
          />
          {!isOwner ? (
            <Text variant="bodySm" tone="muted" style={styles.note}>
              Share the code instead — anyone with it can join themselves.
            </Text>
          ) : addable.length === 0 ? (
            <Text variant="bodySm" tone="muted" style={styles.note}>
              Everyone you've added is already in this group. Share the code to
              bring in someone new.
            </Text>
          ) : (
            <View style={styles.list}>
              {addable.map(f => (
                <ListRow
                  key={f.uid}
                  title={f.name}
                  subtitle={f.handle}
                  leading={<Avatar name={f.name} size="md" />}
                  trailing={
                    <Button
                      label="Add"
                      size="sm"
                      onPress={() => addToGroup(group.id, f.uid).catch(() => {})}
                      iconLeft={<UserPlus color={theme.colors.onAccent} size={14} />}
                    />
                  }
                />
              ))}
            </View>
          )}

          <Button
            label="Leave group"
            variant="ghost"
            size="md"
            style={styles.leave}
            onPress={leave}
            iconLeft={<LogOut color={theme.colors.accent} size={16} />}
          />
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
  actions: { flexDirection: 'row', columnGap: 10, marginTop: 20 },
  tabs: { marginTop: 24 },
  list: { marginTop: 12, rowGap: 4 },
  section: { marginTop: 30 },
  note: { marginTop: 10 },
  leave: { marginTop: 26, alignSelf: 'flex-start' },
  challenge: { marginBottom: 8 },
  challengeMeta: { marginTop: 4 },
  challengeBar: { marginTop: 12 },
});
