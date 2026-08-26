import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Flame,
  Hand,
  ShieldCheck,
  Swords,
  Trophy,
  Video,
} from 'lucide-react-native';

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
import { NOTIFICATIONS, memberById, socialStore } from '../../services';
import type { AppNotification, NotificationKind, Poke } from '../../services';
import { useSocial } from '../../hooks';
import { useTheme } from '../../theme';

/**
 * A received nudge rendered as a notification.
 *
 * Pokes live in their own store because they are written by the app, while
 * `NOTIFICATIONS` is fixture data — but they are the same thing to a reader,
 * so they are projected into one shape and one sorted list rather than given a
 * separate section nobody would think to scroll to.
 */
const pokeToNotification = (p: Poke): AppNotification => ({
  id: p.id,
  kind: p.kind === 'challenge' ? 'challenge' : 'nudge',
  title: `${memberById(p.fromId).name} ${p.kind === 'challenge' ? 'challenged you' : 'nudged you'}`,
  body: `${memberById(p.fromId).name} ${p.message}`,
  createdAt: p.createdAt,
  read: p.read,
  memberId: p.fromId,
});

const relativeTime = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

/** Notification centre: streaks, team status, and proof that needs attention. */
export function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { received } = useSocial();
  const [fixtures, setFixtures] = useState<AppNotification[]>(NOTIFICATIONS);

  const items = useMemo(
    () =>
      [...received.map(pokeToNotification), ...fixtures].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [received, fixtures],
  );

  const unread = items.filter(n => !n.read);
  const earlier = items.filter(n => n.read);

  const iconFor = (kind: NotificationKind) => {
    const c = theme.colors.onAccent;
    switch (kind) {
      case 'team_losing':
        return <Swords color={c} size={18} />;
      case 'team_winning':
        return <Trophy color={c} size={18} />;
      case 'proof_pending':
        return <Video color={c} size={18} />;
      case 'proof_verified':
        return <ShieldCheck color={c} size={18} />;
      case 'streak_reminder':
        return <Flame color={c} size={18} />;
      case 'nudge':
        return <Hand color={c} size={18} />;
      case 'challenge':
        return <Swords color={c} size={18} />;
      default:
        return <Trophy color={c} size={18} />;
    }
  };

  const markAllRead = () => {
    setFixtures(prev => prev.map(n => ({ ...n, read: true })));
    socialStore.markPokesRead();
  };

  const renderRow = (n: AppNotification) => (
    // Unread takes the *brighter* surface. In dark mode `light` and `dark`
    // sit within a few percent of each other and the distinction vanishes.
    <Card
      key={n.id}
      variant={n.read ? 'light' : 'muted'}
      padding="base"
      elevation={n.read ? 'sm' : 'md'}
      style={styles.row}>
      <View style={styles.rowInner}>
        {n.memberId ? (
          <Avatar name={memberById(n.memberId).name} size="md" />
        ) : (
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.pill,
              },
            ]}>
            {iconFor(n.kind)}
          </View>
        )}

        <View style={styles.copy}>
          <Text variant="bodyStrong">{n.title}</Text>
          <Text variant="bodySm" tone="muted" style={styles.body}>
            {n.body}
          </Text>
        </View>

        <View style={styles.meta}>
          <Text variant="label" tone="muted">
            {relativeTime(n.createdAt)}
          </Text>
          {!n.read ? (
            <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
          ) : null}
        </View>
      </View>
    </Card>
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
        {unread.length > 0 ? (
          <Button label="Mark all read" variant="ghost" size="sm" onPress={markAllRead} />
        ) : null}
      </View>

      <Text variant="displaySm" style={styles.title}>
        Notifications
      </Text>

      {items.length === 0 ? (
        <EmptyState title="All clear" body="Nothing needs your attention right now." />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  title: { marginTop: 20 },
  section: { marginTop: 28 },
  list: { marginTop: 12, rowGap: 10 },
  row: {},
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', columnGap: 12 },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  body: { marginTop: 2 },
  meta: { alignItems: 'flex-end', rowGap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
