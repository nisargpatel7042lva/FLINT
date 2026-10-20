import React, { useMemo, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Hand, LogOut, Megaphone, Share2 } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import { useSocial } from '../../hooks';
import { useClubRuns } from '../../hooks/useClubRuns';
import type { BoardEntry, Group } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { inviteMessage } from '../profile/JoinClubScreen';
import { ClubWeek } from './ClubWeek';
import { relativeTime } from './relativeTime';
import { useTheme } from '../../theme';

type Member = {
  uid: string;
  name: string;
  entry: BoardEntry | null;
};

/**
 * One club: its week, and the people in it.
 *
 * Built only from the real group and its real runs. An earlier version listed
 * members from fixtures, which for any real club meant strangers' names and
 * made-up points — the fastest way to convince a tester the app is fake.
 */
export function GroupDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
  const { groupById, uid, sendPoke, spent, leaveGroup, removeFromGroup, nameFor, photoFor } =
    useSocial();

  const group = groupById(route.params.groupId);

  if (!group) {
    return (
      <Screen padding="lg" center>
        <Text variant="bodyStrong">This club is not available</Text>
        <Text variant="bodySm" tone="muted" style={styles.subtitle}>
          You may have left it, or it is still loading.
        </Text>
        <Button
          label="Back"
          variant="outline"
          size="md"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </Screen>
    );
  }

  return (
    <ClubDetail
      group={group}
      uid={uid}
      nameFor={nameFor}
      photoFor={photoFor}
      onBack={() => navigation.goBack()}
      onLeave={async () => {
        // Navigate first: the moment the write lands this club stops being
        // readable, and this screen would be rendering something it cannot see.
        navigation.goBack();
        await leaveGroup(group.id).catch(() => {});
      }}
      onRemove={memberUid => removeFromGroup(group.id, memberUid).catch(() => {})}
      nudge={(memberUid, name) =>
        sendPoke({ uid: memberUid, name, handle: '' }, 'poke', group.id).catch(() => false)
      }
      nudged={memberUid => spent(memberUid, 'poke')}
      accent={theme.colors.accent}
    />
  );
}

type ClubDetailProps = {
  group: Group;
  uid: string;
  nameFor: (uid: string) => string;
  photoFor: (uid: string) => string | undefined;
  onBack: () => void;
  onLeave: () => void;
  onRemove: (uid: string) => void;
  nudge: (uid: string, name: string) => Promise<boolean>;
  nudged: (uid: string) => boolean;
  accent: string;
};

function ClubDetail({
  group,
  uid,
  nameFor,
  photoFor,
  onBack,
  onLeave,
  onRemove,
  nudge,
  nudged,
  accent,
}: ClubDetailProps) {
  const theme = useTheme();
  const { board } = useClubRuns(group.id, uid);
  const [nudging, setNudging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isOwner = group.ownerUid === uid;
  const isClub = group.kind === 'club';

  const members: Member[] = useMemo(() => {
    const byUid = new Map(board.map(e => [e.uid, e]));
    return group.memberIds
      .map(id => ({ uid: id, name: id === uid ? 'You' : nameFor(id), entry: byUid.get(id) ?? null }))
      .sort((a, b) => (b.entry?.km ?? -1) - (a.entry?.km ?? -1) || a.name.localeCompare(b.name));
  }, [group.memberIds, board, uid, nameFor]);

  /** Who has not run this week — the organiser's to-do list. */
  const slipping = members.filter(m => m.uid !== uid && !m.entry);

  const invite = () => {
    Share.share({
      message: isClub
        ? inviteMessage(group)
        : `Join my squad "${group.name}" on Flint. Code: ${group.code}`,
    }).catch(() => {
      // A dismissed share sheet rejects on some Android builds. Nothing to do.
    });
  };

  const nudgeAll = async () => {
    setNudging(true);
    const targets = slipping.filter(m => !nudged(m.uid));
    const sent = await Promise.all(targets.map(m => nudge(m.uid, m.name)));
    setNudging(false);
    const n = sent.filter(Boolean).length;
    setNotice(
      n > 0
        ? `Nudged ${n} ${n === 1 ? 'runner' : 'runners'}. They'll see it next time they open Flint.`
        : 'Everyone on the list has already had a nudge today.',
    );
  };

  const confirmLeave = () =>
    Alert.alert(`Leave ${group.name}?`, 'Your runs stop counting for this club.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onLeave },
    ]);

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Go back" variant="muted" size="md" onPress={onBack}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        <Chip label="Code" value={group.code} variant="muted" />
      </View>

      <Text variant="displaySm" style={styles.title}>
        {group.name}
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
        {isOwner ? ' · you run this club' : ''}
      </Text>

      <View style={styles.actions}>
        <Button
          label={isClub ? 'Invite runners' : 'Invite'}
          size="md"
          onPress={invite}
          iconLeft={<Share2 color={theme.colors.onAccent} size={16} />}
        />
      </View>

      {/*
        The organiser's view. Most run clubs are held together by one person
        chasing people on WhatsApp; this is that chase, in one tap.
      */}
      {isOwner && group.memberIds.length > 1 ? (
        <Card variant="dark" padding="base" radius="xl" style={styles.organiser}>
          <View style={styles.row}>
            <Megaphone color={accent} size={20} />
            <Text variant="bodyStrong" tone="inverse" style={styles.flex}>
              {slipping.length === 0
                ? 'Everyone has run this week'
                : `${slipping.length} of ${group.memberIds.length - 1} haven't run this week`}
            </Text>
          </View>
          {slipping.length > 0 ? (
            <>
              <Text variant="bodySm" tone="inverseMuted" style={styles.organiserText}>
                {slipping
                  .slice(0, 4)
                  .map(m => m.name)
                  .join(', ')}
                {slipping.length > 4 ? ` and ${slipping.length - 4} more` : ''}
              </Text>
              <Button
                label={nudging ? 'Nudging…' : 'Nudge them all'}
                size="sm"
                disabled={nudging}
                onPress={nudgeAll}
                iconLeft={<Hand color={theme.colors.onAccent} size={14} />}
                style={styles.organiserAction}
              />
            </>
          ) : null}
          {notice ? (
            <Text variant="caption" tone="inverseMuted" style={styles.organiserText}>
              {notice}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <ClubWeek groupId={group.id} clubName={group.name} uid={uid} nameFor={nameFor} />

      <SectionHeader title="Members" subtitle="This week" style={styles.section} />
      <View style={styles.list}>
        {members.map(m => {
          const isMe = m.uid === uid;
          const done = nudged(m.uid);
          return (
            <ListRow
              key={m.uid}
              title={m.name}
              subtitle={
                m.entry
                  ? `${m.entry.km.toFixed(1)} km · ${m.entry.runs} run${
                      m.entry.runs === 1 ? '' : 's'
                    } · last ${relativeTime(m.entry.lastRunAt)}`
                  : 'No run this week'
              }
              leading={
                <Avatar
                  name={m.name}
                  size="md"
                  source={photoFor(m.uid) ? { uri: photoFor(m.uid) } : undefined}
                />
              }
              trailing={
                isMe ? undefined : (
                  <View style={styles.row}>
                    <Button
                      label={done ? 'Nudged' : 'Nudge'}
                      size="sm"
                      variant={done ? 'ghost' : 'outline'}
                      disabled={done}
                      onPress={() => nudge(m.uid, m.name)}
                      iconLeft={
                        <Hand color={done ? theme.colors.textMuted : theme.colors.text} size={14} />
                      }
                    />
                    {isOwner ? (
                      <Button
                        label="Remove"
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          Alert.alert(`Remove ${m.name}?`, 'They can rejoin with the code.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => onRemove(m.uid) },
                          ])
                        }
                      />
                    ) : null}
                  </View>
                )
              }
            />
          );
        })}
      </View>

      <Button
        label={isClub ? 'Leave club' : 'Leave squad'}
        variant="ghost"
        size="md"
        style={styles.leave}
        onPress={confirmLeave}
        iconLeft={<LogOut color={theme.colors.accent} size={16} />}
      />
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
  backButton: { marginTop: 16 },
  actions: { flexDirection: 'row', columnGap: 10, marginTop: 20 },
  organiser: { marginTop: 20 },
  organiserText: { marginTop: 8 },
  organiserAction: { marginTop: 12, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  flex: { flex: 1 },
  section: { marginTop: 30 },
  list: { marginTop: 12, rowGap: 4 },
  leave: { marginTop: 26, alignSelf: 'flex-start' },
});
