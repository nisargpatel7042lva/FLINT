import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BellOff, Hand, Play, Swords } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import type { Poke } from '../../services';
import { useSocial } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { relativeTime } from './relativeTime';
import { useTheme } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Notifications: nudges and challenges from real people, live.
 *
 * Fed by a Firestore listener, so a nudge appears here the moment it is sent,
 * with no refresh. An earlier version padded this list with sample
 * notifications ("your team is losing", proof to review) that never changed —
 * which is exactly why it felt static. Everything here now is real.
 *
 * Opening the screen marks what is on it as read.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { received, nameFor, photoFor, markInboxRead, sendPoke, spent } = useSocial();

  const items = useMemo(
    () => [...received].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [received],
  );
  const unread = items.filter(p => !p.read);
  const earlier = items.filter(p => p.read);

  // Seen once the screen has been open a moment, not on the first frame — so
  // the "New" section is still there to read.
  useEffect(() => {
    if (unread.length === 0) {
      return;
    }
    const t = setTimeout(() => {
      markInboxRead().catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [unread.length, markInboxRead]);

  const run = () => navigation.navigate('Tracking', { kind: 'run' });

  const renderRow = (p: Poke) => {
    const name = nameFor(p.fromId);
    const challenge = p.kind === 'challenge';
    const repliedToday = spent(p.fromId, 'poke');
    return (
      <Card
        key={p.id}
        variant={p.read ? 'light' : 'muted'}
        padding="base"
        elevation={p.read ? 'sm' : 'md'}>
        <View style={styles.rowInner}>
          <Avatar
            name={name}
            size="md"
            source={photoFor(p.fromId) ? { uri: photoFor(p.fromId) } : undefined}
          />
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              {challenge ? (
                <Swords color={theme.colors.accent} size={14} />
              ) : (
                <Hand color={theme.colors.accent} size={14} />
              )}
              <Text variant="bodyStrong" style={styles.flex}>
                {name} {challenge ? 'challenged you' : 'nudged you'}
              </Text>
              <Text variant="label" tone="muted">
                {relativeTime(p.createdAt)}
              </Text>
            </View>
            <Text variant="bodySm" tone="muted" style={styles.body}>
              {p.message}
            </Text>
            <View style={styles.actions}>
              <Button
                label={challenge ? 'Take it on' : 'Go run'}
                size="sm"
                onPress={run}
                iconLeft={<Play color={theme.colors.onAccent} size={14} />}
              />
              <Button
                label={repliedToday ? 'Nudged back' : 'Nudge back'}
                size="sm"
                variant="outline"
                disabled={repliedToday}
                onPress={() => {
                  sendPoke({ uid: p.fromId, name, handle: '' }, 'poke').catch(() => {});
                }}
              />
            </View>
          </View>
          {!p.read ? (
            <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
          ) : null}
        </View>
      </Card>
    );
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
      </View>

      <Text variant="displaySm" style={styles.title}>
        Notifications
      </Text>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="Nudges and challenges from your club land here the moment they are sent."
          icon={<BellOff color={theme.colors.textMuted} size={26} />}
        />
      ) : (
        <View>
          {unread.length > 0 ? (
            <View>
              <SectionHeader
                title="New"
                subtitle={`${unread.length} unread`}
                style={styles.section}
              />
              <View style={styles.list}>{unread.map(renderRow)}</View>
            </View>
          ) : null}
          {earlier.length > 0 ? (
            <View>
              <SectionHeader title="Earlier" style={styles.section} />
              <View style={styles.list}>{earlier.map(renderRow)}</View>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  title: { marginTop: 20 },
  section: { marginTop: 28 },
  list: { marginTop: 12, rowGap: 10 },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', columnGap: 12 },
  copy: { flex: 1 },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  body: { marginTop: 2 },
  actions: { flexDirection: 'row', columnGap: 8, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
