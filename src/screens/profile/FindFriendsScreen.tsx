import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, Contact, Search, UserPlus } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  IconButton,
  Input,
  ListRow,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import type { PublicProfile } from '../../services/socialRepository';
import { useSocial } from '../../hooks';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

const SEARCH_DELAY_MS = 300;

/**
 * Step 3 of profile setup: find people to train with.
 *
 * Search by handle rather than a browsable directory. A list of every account
 * on the platform is not something a fitness app should hand out, and once
 * these are real people it stops being a design choice.
 */
export function FindFriendsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const { friends, searchProfiles, addFriend } = useSocial();
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

  const finish = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <SetupHeader
        step={4}
        title={'Find your\ntraining partners'}
        subtitle="Friends make streaks stick. You can skip and add people later."
      />

      <Input
        placeholder="Search by @handle"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        iconLeft={<Search color={theme.colors.textMuted} size={18} />}
        containerStyle={styles.search}
      />

      {/* Contacts permission flow lands with the real integration. */}
      <Card variant="light" padding="base" style={styles.contactsCard}>
        <View style={styles.contactsRow}>
          <IconButton accessibilityLabel="Sync contacts" variant="accent" size="md">
            <Contact color={theme.colors.onAccent} size={20} />
          </IconButton>
          <View style={styles.contactsCopy}>
            <Text variant="bodyStrong">Sync your contacts</Text>
            <Text variant="bodySm" tone="muted">
              See which of your contacts already train on Flint.
            </Text>
          </View>
        </View>
        <Button
          label="Allow access"
          variant="outline"
          size="sm"
          fullWidth
          style={styles.contactsCta}
        />
      </Card>

      <SectionHeader
        title="Results"
        subtitle={friends.length > 0 ? `${friends.length} added` : undefined}
        style={styles.section}
      />

      <View style={styles.list}>
        {query.trim().length < 2 ? (
          <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
            Search for a friend's handle to add them.
          </Text>
        ) : searching ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.empty} />
        ) : results.length === 0 ? (
          <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
            No one matches “{query.trim()}”.
          </Text>
        ) : (
          results.map(person => {
            const isAdded = friendUids.has(person.uid);
            return (
              <ListRow
                key={person.uid}
                title={person.name}
                subtitle={person.handle}
                leading={<Avatar name={person.name} size="md" />}
                trailing={
                  <IconButton
                    accessibilityLabel={
                      isAdded ? `${person.name} added` : `Add ${person.name}`
                    }
                    variant={isAdded ? 'accent' : 'muted'}
                    size="sm"
                    disabled={isAdded}
                    onPress={() => addFriend(person)}>
                    {isAdded ? (
                      <Check color={theme.colors.onAccent} size={16} strokeWidth={3} />
                    ) : (
                      <UserPlus color={theme.colors.text} size={16} />
                    )}
                  </IconButton>
                }
              />
            );
          })
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label={friends.length > 0 ? `Continue with ${friends.length}` : 'Continue'}
          size="lg"
          fullWidth
          onPress={finish}
        />
        <Button label="Skip for now" variant="ghost" size="md" fullWidth onPress={finish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  search: { marginTop: 24 },
  contactsCard: { marginTop: 16 },
  contactsRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  contactsCopy: { flex: 1 },
  contactsCta: { marginTop: 14 },
  section: { marginTop: 28 },
  list: { marginTop: 4 },
  empty: { marginTop: 24 },
  actions: { marginTop: 24, rowGap: 4 },
});
