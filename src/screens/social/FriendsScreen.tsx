import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Hand,
  Search,
  Swords,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';

import {
  Avatar,
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
  CURRENT_USER_ID,
  memberById,
  pokeLabel,
  socialStore,
  todayKey,
} from '../../services';
import { useSocial } from '../../hooks';
import { useTheme } from '../../theme';
import { relativeTime } from './relativeTime';

type Tab = 'friends' | 'find';

/**
 * Your people.
 *
 * Two actions per friend, and deliberately no more: a nudge ("thinking of
 * you") and a challenge ("go head to head"). Both are capped at one per person
 * per day by the store — the cap is what keeps a poke button from becoming
 * something people mute.
 */
export function FriendsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [tab, setTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');

  const { friends, suggestions, pokes, received } = useSocial();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return suggestions;
    }
    return suggestions.filter(
      s => s.name.toLowerCase().includes(q) || s.handle.toLowerCase().includes(q),
    );
  }, [query, suggestions]);

  /** Pokes I sent, newest first — the record of what I've already done today. */
  const sent = useMemo(
    () => pokes.filter(p => p.fromId === CURRENT_USER_ID).slice(0, 6),
    [pokes],
  );

  const today = todayKey();
  const spent = (toId: string, kind: 'poke' | 'challenge') =>
    pokes.some(
      p =>
        p.fromId === CURRENT_USER_ID &&
        p.toId === toId &&
        p.kind === kind &&
        p.day === today,
    );

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
        {received.length > 0 ? (
          <Chip label="Inbox" value={`${received.length}`} variant="accent" />
        ) : null}
      </View>

      <Text variant="displaySm" style={styles.title}>
        Friends
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        Nudge someone who's gone quiet, or call them out for a head-to-head.
      </Text>

      <SegmentedControl<Tab>
        segments={[
          { value: 'friends', label: `Friends (${friends.length})` },
          { value: 'find', label: 'Add people' },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />

      {tab === 'friends' ? (
        <View>
          {friends.length === 0 ? (
            <EmptyState
              title="No friends yet"
              body="Add a few people and you can nudge or challenge them from here."
              icon={<Users color={theme.colors.textMuted} size={26} />}
              action={<Button label="Add people" onPress={() => setTab('find')} />}
            />
          ) : (
            <View style={styles.list}>
              {friends.map(f => {
                const nudged = spent(f.id, 'poke');
                const challenged = spent(f.id, 'challenge');
                return (
                  <ListRow
                    key={f.id}
                    filled
                    title={f.name}
                    subtitle={f.handle}
                    leading={<Avatar name={f.name} size="md" />}
                    trailing={
                      <View style={styles.rowActions}>
                        <IconButton
                          accessibilityLabel={
                            nudged ? `Already nudged ${f.name}` : `Nudge ${f.name}`
                          }
                          variant={nudged ? 'muted' : 'accent'}
                          size="sm"
                          disabled={nudged}
                          onPress={() => socialStore.sendPoke(f.id, 'poke')}>
                          <Hand
                            color={nudged ? theme.colors.textMuted : theme.colors.onAccent}
                            size={16}
                          />
                        </IconButton>
                        <IconButton
                          accessibilityLabel={
                            challenged
                              ? `Already challenged ${f.name}`
                              : `Challenge ${f.name}`
                          }
                          variant="muted"
                          size="sm"
                          disabled={challenged}
                          onPress={() => socialStore.sendPoke(f.id, 'challenge')}>
                          <Swords
                            color={
                              challenged ? theme.colors.textMuted : theme.colors.text
                            }
                            size={16}
                          />
                        </IconButton>
                      </View>
                    }
                  />
                );
              })}
            </View>
          )}

          {sent.length > 0 ? (
            <>
              <SectionHeader
                title="Sent today"
                subtitle="One nudge and one challenge per person per day"
                style={styles.section}
              />
              <Card variant="light" padding="base" radius="xl">
                <View style={styles.sentList}>
                  {sent.map(p => (
                    <View key={p.id} style={styles.sentRow}>
                      <Text variant="bodySm" style={styles.flex}>
                        <Text variant="bodyStrong">{pokeLabel(p.kind)}</Text>
                        {` → ${memberById(p.toId).name}`}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {relativeTime(p.createdAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}
        </View>
      ) : (
        <View>
          <Input
            placeholder="Search by name or @username"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            iconLeft={<Search color={theme.colors.textMuted} size={18} />}
            containerStyle={styles.search}
          />

          {results.length === 0 ? (
            <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
              {query.trim()
                ? `No one matches “${query.trim()}”.`
                : "You've added everyone we know about."}
            </Text>
          ) : (
            <View style={styles.list}>
              {results.map(person => (
                <ListRow
                  key={person.id}
                  title={person.name}
                  subtitle={person.handle}
                  leading={<Avatar name={person.name} size="md" />}
                  trailing={
                    <Button
                      label="Add"
                      size="sm"
                      onPress={() => socialStore.addFriend(person.id)}
                      iconLeft={<UserPlus color={theme.colors.onAccent} size={14} />}
                    />
                  }
                />
              ))}
            </View>
          )}

          {friends.length > 0 ? (
            <>
              <SectionHeader title="Remove" style={styles.section} />
              <View style={styles.list}>
                {friends.map(f => (
                  <ListRow
                    key={f.id}
                    title={f.name}
                    subtitle={f.handle}
                    leading={<Avatar name={f.name} size="md" />}
                    trailing={
                      <IconButton
                        accessibilityLabel={`Remove ${f.name}`}
                        variant="muted"
                        size="sm"
                        onPress={() => socialStore.removeFriend(f.id)}>
                        <UserMinus color={theme.colors.textMuted} size={16} />
                      </IconButton>
                    }
                  />
                ))}
              </View>
            </>
          ) : null}
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
    paddingTop: 4,
  },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 6 },
  tabs: { marginTop: 22 },
  list: { marginTop: 12, rowGap: 8 },
  rowActions: { flexDirection: 'row', columnGap: 8 },
  section: { marginTop: 30 },
  sentList: { rowGap: 10 },
  sentRow: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  search: { marginTop: 20 },
  empty: { marginTop: 28 },
});
