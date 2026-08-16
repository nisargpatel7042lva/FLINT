import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

/** Stand-in results until the directory/contacts APIs are wired. */
const SUGGESTIONS = [
  { id: '1', name: 'Ava Cole', handle: '@avacole' },
  { id: '2', name: 'Ben Ortiz', handle: '@benortiz' },
  { id: '3', name: 'Cara Diaz', handle: '@caradiaz' },
  { id: '4', name: 'Dan Reed', handle: '@danreed' },
  { id: '5', name: 'Eve Shah', handle: '@eveshah' },
];

/** Step 3 of profile setup: find people to train with. */
export function FindFriendsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<string[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return SUGGESTIONS;
    }
    return SUGGESTIONS.filter(
      s =>
        s.name.toLowerCase().includes(q) || s.handle.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (id: string) =>
    setAdded(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const finish = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <SetupHeader
        step={2}
        title={'Find your\ntraining partners'}
        subtitle="Friends make streaks stick. You can skip and add people later."
      />

      <Input
        placeholder="Search by name or @username"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
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
              See which of your contacts already train on Kasrat.
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
        title="Suggested"
        subtitle={added.length > 0 ? `${added.length} selected` : undefined}
        style={styles.section}
      />

      <View style={styles.list}>
        {results.map(person => {
          const isAdded = added.includes(person.id);
          return (
            <ListRow
              key={person.id}
              title={person.name}
              subtitle={person.handle}
              leading={<Avatar name={person.name} size="md" />}
              trailing={
                <IconButton
                  accessibilityLabel={
                    isAdded ? `Remove ${person.name}` : `Add ${person.name}`
                  }
                  variant={isAdded ? 'accent' : 'muted'}
                  size="sm"
                  onPress={() => toggle(person.id)}>
                  {isAdded ? (
                    <Check color={theme.colors.onAccent} size={16} strokeWidth={3} />
                  ) : (
                    <UserPlus color={theme.colors.text} size={16} />
                  )}
                </IconButton>
              }
            />
          );
        })}

        {results.length === 0 ? (
          <Text variant="bodySm" tone="muted" align="center" style={styles.empty}>
            No one matches “{query.trim()}”.
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={added.length > 0 ? `Continue with ${added.length}` : 'Continue'}
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
