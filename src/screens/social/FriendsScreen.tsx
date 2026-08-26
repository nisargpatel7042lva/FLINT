import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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
import { pokeLabel } from '../../services';
import type { PublicProfile } from '../../services/socialRepository';
import { useSocial } from '../../hooks';
import { useTheme } from '../../theme';
import { relativeTime } from './relativeTime';

type Tab = 'friends' | 'find';

/** Debounce so a search does not fire a query per keystroke. */
const SEARCH_DELAY_MS = 300;

/**
 * Your people.
 *
 * Two actions per friend, and deliberately no more: a nudge ("thinking of
 * you") and a challenge ("go head to head"). Both are capped at one per person
 * per day — and the cap is enforced by the database, not by this screen, so a
 * disabled button here is a courtesy rather than the security boundary.
 */
export function FriendsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [tab, setTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const {
    friends,
    sent,
    received,
    source,
    searchProfiles,
    addFriend,
    removeFriend,
    sendPoke,
    spent,
    nameFor,
  } = useSocial();

  const friendUids = useMemo(() => new Set(friends.map(f => f.uid)), [friends]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let alive = true;
    const t = setTimeout(() => {
      searchProfiles(term)
        .then(found => alive && setResults(found))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false));
    }, SEARCH_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, searchProfiles]);

  const recentlySent = sent.slice(0, 6);

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
        {source === 'firestore'
          ? "Nudge someone who's gone quiet — it lands on their phone."
          : 'Running on local data: nudges are recorded on this device only.'}
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
              body="Search for someone by their @handle and you can nudge or challenge them from here."
              icon={<Users color={theme.colors.textMuted} size={26} />}
              action={<Button label="Add people" onPress={() => setTab('find')} />}
            />
          ) : (
            <View style={styles.list}>
              {friends.map(f => {
                const nudged = spent(f.uid, 'poke');
                const challenged = spent(f.uid, 'challenge');
                return (
                  <ListRow
                    key={f.uid}
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
                          onPress={() => sendPoke(f, 'poke')}>
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
                          onPress={() => sendPoke(f, 'challenge')}>
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

          {recentlySent.length > 0 ? (
            <>
              <SectionHeader
                title="Sent"
                subtitle="One nudge and one challenge per person per day"
                style={styles.section}
              />
              <Card variant="light" padding="base" radius="xl">
                <View style={styles.sentList}>
                  {recentlySent.map(p => (
                    <View key={p.id} style={styles.sentRow}>
                      <Text variant="bodySm" style={styles.flex}>
                        <Text variant="bodyStrong">{pokeLabel(p.kind)}</Text>
                        {` → ${nameFor(p.toId)}`}
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
            placeholder="Search by @handle"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            hint="Handles are unique. Ask your friend for theirs."
            iconLeft={<Search color={theme.colors.textMuted} size={18} />}
            containerStyle={styles.search}
          />

          {query.trim().length < 2 ? (
            <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
              Type at least two characters.
            </Text>
          ) : searching ? (
            <ActivityIndicator color={theme.colors.accent} style={styles.empty} />
          ) : results.length === 0 ? (
            <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
              No one matches “{query.trim()}”.
            </Text>
          ) : (
            <View style={styles.list}>
              {results.map(person => {
                const already = friendUids.has(person.uid);
                return (
                  <ListRow
                    key={person.uid}
                    title={person.name}
                    subtitle={person.handle}
                    leading={<Avatar name={person.name} size="md" />}
                    trailing={
                      already ? (
                        <Chip label="Added" variant="muted" />
                      ) : (
                        <Button
                          label="Add"
                          size="sm"
                          onPress={() => addFriend(person)}
                          iconLeft={<UserPlus color={theme.colors.onAccent} size={14} />}
                        />
                      )
                    }
                  />
                );
              })}
            </View>
          )}

          {friends.length > 0 ? (
            <>
              <SectionHeader title="Remove" style={styles.section} />
              <View style={styles.list}>
                {friends.map(f => (
                  <ListRow
                    key={f.uid}
                    title={f.name}
                    subtitle={f.handle}
                    leading={<Avatar name={f.name} size="md" />}
                    trailing={
                      <IconButton
                        accessibilityLabel={`Remove ${f.name}`}
                        variant="muted"
                        size="sm"
                        onPress={() => removeFriend(f.uid)}>
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
