import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Check, Plus, Swords, UserRound, Users } from 'lucide-react-native';

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
  GROUPS,
  SUBMISSIONS,
  TODAY,
  WAR,
  groupDayScore,
  memberById,
  pluralDays,
  socialStore,
  warGroups,
  warStanding,
} from '../../services';
import { useSocial } from '../../hooks';
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

  const { groups: mine, received } = useSocial();

  const groups = useMemo(() => warGroups(), []);
  const standing = useMemo(
    () => warStanding(WAR, groups, SUBMISSIONS, TODAY),
    [groups],
  );

  const trimmedCode = code.trim().toUpperCase();
  const alreadyIn = mine.some(g => g.code.toUpperCase() === trimmedCode);
  const joinTarget = GROUPS.find(g => g.code.toUpperCase() === trimmedCode);

  const create = () => {
    const group = socialStore.createGroup(newName);
    setNewName('');
    setMode('mine');
    navigation.navigate('GroupDetail', { groupId: group.id });
  };

  const join = () => {
    const joined = socialStore.joinGroup(trimmedCode);
    if (!joined) {
      setNotice('No group matches that code.');
      return;
    }
    setCode('');
    setNotice(null);
    setMode('mine');
    navigation.navigate('GroupDetail', { groupId: joined.id });
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text variant="label" tone="accent" uppercase>
          Squads
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
        Your groups
      </Text>

      <SegmentedControl<Mode>
        segments={[
          { value: 'mine', label: 'My groups' },
          { value: 'join', label: 'Create / join' },
        ]}
        value={mode}
        onChange={setMode}
        style={styles.tabs}
      />

      {mode === 'mine' ? (
        <View>
          {/* Active war gets top billing — it's the reason to open the app. */}
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

          <SectionHeader
            title="Groups"
            actionLabel="New"
            onActionPress={() => setMode('join')}
            style={styles.section}
          />

          {mine.length === 0 ? (
            <EmptyState
              title="No groups yet"
              body="Create a squad or join one with a code to start challenging people."
              icon={<Users color={theme.colors.textMuted} size={26} />}
              action={<Button label="Create a group" onPress={() => setMode('join')} />}
            />
          ) : (
            <View style={styles.list}>
              {mine.map(g => {
                const score = groupDayScore(g, SUBMISSIONS, TODAY);
                return (
                  <ListRow
                    key={g.id}
                    filled
                    title={g.name}
                    subtitle={`${g.memberIds.length} members · ${score.toLocaleString()} pts today`}
                    leading={
                      <AvatarGroup
                        names={g.memberIds.map(id => memberById(id).name)}
                        max={3}
                        size="sm"
                        borderColor={theme.colors.surface}
                      />
                    }
                    onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
                  />
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <View>
          <SectionHeader title="Create a group" style={styles.section} />
          <Input
            label="Group name"
            placeholder="e.g. Morning Crew"
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="words"
            hint="You get a join code to share the moment it exists."
            containerStyle={styles.input}
          />
          <Button
            label="Create group"
            size="lg"
            fullWidth
            disabled={newName.trim().length < 3}
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

          {trimmedCode.length > 0 ? (
            joinTarget ? (
              <ListRow
                filled
                title={joinTarget.name}
                subtitle={`${joinTarget.memberIds.length} members`}
                leading={
                  <AvatarGroup
                    names={joinTarget.memberIds.map(id => memberById(id).name)}
                    max={3}
                    size="sm"
                    borderColor={theme.colors.surface}
                  />
                }
                trailing={
                  alreadyIn ? (
                    <Chip
                      label="Joined"
                      variant="muted"
                      icon={<Check color={theme.colors.textMuted} size={14} />}
                    />
                  ) : (
                    <Button label="Join" size="sm" onPress={join} />
                  )
                }
                style={styles.joinResult}
              />
            ) : (
              <Text variant="bodySm" tone="muted" style={styles.joinResult}>
                No group matches that code.
              </Text>
            )
          ) : null}

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
  section: { marginTop: 28 },
  list: { marginTop: 8, rowGap: 8 },
  input: { marginTop: 12 },
  createCta: { marginTop: 16 },
  joinResult: { marginTop: 12 },
});
