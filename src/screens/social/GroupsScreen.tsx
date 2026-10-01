import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  Footprints,
  Plus,
  Swords,
  Target,
  UserRound,
} from 'lucide-react-native';

import {
  AvatarGroup,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Input,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
} from '../../components';
import {
  ACTIVITY_LABELS,
  SUBMISSIONS,
  TODAY,
  WAR,
  normaliseCode,
  pluralDays,
  warGroups,
  warStanding,
} from '../../services';
import { useMyChallenges, useSocial } from '../../hooks';
import type { Group, GroupKind } from '../../services/types';
import { useTheme } from '../../theme';

type Mode = 'mine' | 'join';

/** Friend groups: create or join, and jump into a group's detail. */
export function GroupsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [mode, setMode] = useState<Mode>('mine');
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const { groups: mine, received, createGroup, joinGroup, nameFor } = useSocial();
  const { active: activeChallenges, pending: pendingChallenges } = useMyChallenges();
  const [busy, setBusy] = useState(false);
  const [newKind, setNewKind] = useState<GroupKind>('club');

  const clubs = mine.filter(g => g.kind === 'club');
  const squads = mine.filter(g => g.kind !== 'club');

  const groups = useMemo(() => warGroups(), []);
  const standing = useMemo(
    () => warStanding(WAR, groups, SUBMISSIONS, TODAY),
    [groups],
  );

  const trimmedCode = normaliseCode(code);

  /** Whether this account is in either side of the seeded Team War. */
  const inTheWar = mine.some(g => WAR.groupIds.includes(g.id));

  const create = async () => {
    setBusy(true);
    try {
      const group = await createGroup(newName, newKind);
      setNewName('');
      setNotice(null);
      setMode('mine');
      navigation.navigate('GroupDetail', { groupId: group.id });
    } catch {
      setNotice('Could not create that group. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  /*
   * Joining is a round trip, not a lookup.
   *
   * The old screen previewed the match by searching the fixture list as you
   * typed, which could only ever find seeded groups — the one thing a real
   * invite code is not. A code now resolves on the server, so the outcome
   * arrives when you ask for it rather than being guessed locally.
   */
  const join = async () => {
    setBusy(true);
    try {
      const result = await joinGroup(trimmedCode);
      if (result.state === 'unknown') {
        setNotice('No group matches that code.');
        return;
      }
      setCode('');
      setNotice(
        result.state === 'already' ? `You are already in ${result.group.name}.` : null,
      );
      setMode('mine');
      navigation.navigate('GroupDetail', { groupId: result.group.id });
    } catch {
      setNotice('Could not reach that group. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text variant="label" tone="accent" uppercase>
          Clubs
        </Text>
        <View style={styles.topActions}>
          <IconButton
            accessibilityLabel="Notifications"
            variant="muted"
            size="md"
            onPress={() => navigation.navigate('Notifications')}>
            <Bell color={theme.colors.text} size={18} />
          </IconButton>
          <IconButton
            accessibilityLabel={
              received.length > 0
                ? `Friends, ${received.length} waiting`
                : 'Friends'
            }
            variant={received.length > 0 ? 'accent' : 'muted'}
            size="md"
            onPress={() => navigation.navigate('Friends')}>
            <UserRound
              color={received.length > 0 ? theme.colors.onAccent : theme.colors.text}
              size={18}
            />
          </IconButton>
        </View>
      </View>
      <Text variant="displaySm" style={styles.title}>
        Your clubs
      </Text>

      <SegmentedControl<Mode>
        segments={[
          { value: 'mine', label: 'Mine' },
          { value: 'join', label: 'Join / start' },
        ]}
        value={mode}
        onChange={setMode}
        style={styles.tabs}
      />

      {mode === 'mine' ? (
        <View>
          {/*
            Head to head, given top billing.

            This section is the only way into the 1:1 challenge feature. Before
            it, `CreateOneOnOne`, `AcceptChallenge` and `ChallengeDetail` were
            routable but unreachable — nothing in the app navigated to any of
            them, so a challenge you created vanished the moment you left the
            screen that made it, and the person who accepted yours had no list
            it could appear in.
          */}
          {/*
            Clubs lead. The run club is why somebody installed this — their
            Saturday crew is already a group, and the app's job is to put that
            group's week on screen.
          */}
          <SectionHeader title="Run clubs" style={styles.firstSection} />
          {clubs.length === 0 ? (
            <EmptyState
              title="Join your run club"
              body="Ask your club for its code, or start one and share yours. Every run you log counts on the club board."
              icon={<Footprints color={theme.colors.textMuted} size={26} />}
              action={
                <Button
                  label="Enter a club code"
                  onPress={() => {
                    setNewKind('club');
                    setMode('join');
                  }}
                />
              }
            />
          ) : (
            <View style={styles.list}>
              {clubs.map(g => (
                <GroupRow key={g.id} group={g} nameFor={nameFor} />
              ))}
            </View>
          )}

          <SectionHeader title="Head to head" style={styles.section} />

          {activeChallenges.length === 0 && pendingChallenges.length === 0 ? (
            <EmptyState
              title="No challenges running"
              body="Pick an activity and a number of days, then send the link to one person."
              icon={<Target color={theme.colors.textMuted} size={26} />}
              action={
                <Button
                  label="Challenge someone"
                  onPress={() => navigation.navigate('CreateOneOnOne')}
                />
              }
            />
          ) : (
            <View style={styles.list}>
              {[...activeChallenges, ...pendingChallenges].map(c => (
                <ListRow
                  key={c.id}
                  filled
                  title={c.title}
                  subtitle={
                    c.status === 'pending'
                      ? 'Waiting for someone to accept'
                      : `${ACTIVITY_LABELS[c.activityKind]} · ${c.targetDays} days`
                  }
                  leading={<Target color={theme.colors.accent} size={20} />}
                  trailing={
                    <Chip
                      label={c.status === 'pending' ? 'Pending' : 'Live'}
                      variant={c.status === 'pending' ? 'muted' : 'accent'}
                    />
                  }
                  onPress={() =>
                    navigation.navigate('ChallengeDetail', { challengeId: c.id })
                  }
                />
              ))}
              <Button
                label="New challenge"
                variant="outline"
                fullWidth
                style={styles.newChallenge}
                onPress={() => navigation.navigate('CreateOneOnOne')}
                iconLeft={<Plus color={theme.colors.text} size={18} />}
              />
            </View>
          )}

          {/*
            The Team War card is fixture data, and it only belongs on screen
            for somebody actually IN one of the two groups. It used to render
            unconditionally, so a brand-new account was shown a live war
            between two squads it had never heard of, directly above the words
            "No groups yet".
          */}
          {inTheWar ? (
          <Card variant="dark" padding="base" radius="xxl" style={styles.warCard}>
            <View style={styles.warHead}>
              <Chip label="Live" variant="accent" />
              <Text variant="caption" tone="inverseMuted">
                {pluralDays(standing.daysRemaining)} left
              </Text>
            </View>
            <Text variant="h2" tone="inverse" style={styles.warTitle}>
              {WAR.title}
            </Text>
            <Text variant="bodySm" tone="inverseMuted" style={styles.warScore}>
              Days won {standing.daysWon[0]}–{standing.daysWon[1]} · today{' '}
              {standing.today.scores[0].toLocaleString()} v{' '}
              {standing.today.scores[1].toLocaleString()}
            </Text>
            <Button
              label="Open Team War"
              size="sm"
              style={styles.warCta}
              onPress={() => navigation.navigate('TeamWar', { warId: WAR.id })}
              iconLeft={<Swords color={theme.colors.onAccent} size={16} />}
            />
          </Card>
          ) : null}

          <SectionHeader
            title="Squads"
            subtitle="Small groups inside a club, for challenging each other"
            actionLabel="New"
            onActionPress={() => {
              setNewKind('squad');
              setMode('join');
            }}
            style={styles.section}
          />

          {squads.length === 0 ? (
            <Text variant="bodySm" tone="muted" style={styles.quiet}>
              No squads yet. Pull three or four people from your club into one and
              challenge each other.
            </Text>
          ) : (
            <View style={styles.list}>
              {squads.map(g => (
                <GroupRow key={g.id} group={g} nameFor={nameFor} />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View>
          <SectionHeader title="Start one" style={styles.section} />
          <SegmentedControl<GroupKind>
            segments={[
              { value: 'club', label: 'Run club' },
              { value: 'squad', label: 'Squad' },
            ]}
            value={newKind}
            onChange={setNewKind}
            style={styles.kindPicker}
          />
          <Text variant="bodySm" tone="muted" style={styles.kindHint}>
            {newKind === 'club'
              ? 'The whole club — one weekly board, everyone\u2019s runs in one feed.'
              : 'A handful of people who want to push each other harder.'}
          </Text>
          <Input
            label={newKind === 'club' ? 'Club name' : 'Squad name'}
            placeholder={newKind === 'club' ? 'e.g. Sunrise Runners' : 'e.g. Sub-25 Crew'}
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="words"
            hint="You get a join code to share the moment it exists."
            containerStyle={styles.input}
          />
          <Button
            label={newKind === 'club' ? 'Start club' : 'Start squad'}
            size="lg"
            fullWidth
            disabled={newName.trim().length < 3 || busy}
            style={styles.createCta}
            onPress={create}
            iconLeft={<Plus color={theme.colors.onAccent} size={18} />}
          />

          <SectionHeader title="Join with a code" style={styles.section} />
          <Input
            label="Invite code"
            placeholder="e.g. WOLF42"
            value={code}
            onChangeText={next => {
              setCode(next);
              setNotice(null);
            }}
            autoCapitalize="characters"
            hint="Ask a member for the group's code."
            containerStyle={styles.input}
          />

          <Button
            label="Join group"
            variant="outline"
            size="lg"
            fullWidth
            disabled={trimmedCode.length < 4 || busy}
            style={styles.createCta}
            onPress={join}
          />

          {notice ? (
            <Text variant="bodySm" tone="muted" style={styles.joinResult}>
              {notice}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function GroupRow({ group, nameFor }: { group: Group; nameFor: (uid: string) => string }) {
  const theme = useTheme();
  const navigation = useNavigation();
  return (
    <ListRow
      filled
      title={group.name}
      subtitle={`${group.memberIds.length} ${group.memberIds.length === 1 ? 'member' : 'members'}`}
      leading={
        <AvatarGroup
          names={group.memberIds.map(nameFor)}
          max={3}
          size="sm"
          borderColor={theme.colors.surface}
        />
      }
      onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  topActions: { flexDirection: 'row', columnGap: 8 },
  title: { marginTop: 6 },
  tabs: { marginTop: 20 },
  warCard: { marginTop: 20 },
  warHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warTitle: { marginTop: 12 },
  warScore: { marginTop: 4 },
  warCta: { marginTop: 14 },
  firstSection: { marginTop: 24 },
  newChallenge: { marginTop: 4 },
  section: { marginTop: 28 },
  quiet: { marginTop: 8 },
  kindPicker: { marginTop: 12 },
  kindHint: { marginTop: 8 },
  list: { marginTop: 8, rowGap: 8 },
  input: { marginTop: 12 },
  createCta: { marginTop: 16 },
  joinResult: { marginTop: 12 },
});
