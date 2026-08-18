import React, { useMemo, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Play, ShieldCheck, Swords } from 'lucide-react-native';

import {
  Avatar,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ReactionBar,
  Screen,
  SegmentedControl,
  Text,
} from '../../components';
import {
  TODAY,
  effortPoints,
  feedSubmissions,
  memberById,
  unreadCount,
} from '../../services';
import type { ReactionKey, Submission } from '../../services';
import { placeholderPhoto, remote } from '../../assets/placeholders';
import { useTheme } from '../../theme';

type Filter = 'all' | 'war' | 'pending';

const relativeTime = (iso: string) => {
  const then = new Date(iso).getTime();
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
};

const summarise = (s: Submission) => {
  const bits: string[] = [];
  if (s.effort.workouts > 0) {
    bits.push(`${s.effort.workouts} workout`);
  }
  if (s.effort.distanceKm > 0) {
    bits.push(`${s.effort.distanceKm} km`);
  }
  bits.push(`${s.effort.kcal} kcal`);
  return bits.join(' · ');
};

/**
 * The witness feed — the spectator layer.
 *
 * Proof is the unit of content: who did what, whether it's been verified, and
 * how the group reacted. Reactions are local-only until the backend lands.
 */
export function FeedScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [filter, setFilter] = useState<Filter>('all');
  const [reactions, setReactions] = useState<Record<string, ReactionKey[]>>({});

  const items = useMemo(() => {
    const all = feedSubmissions();
    if (filter === 'war') {
      return all.filter(s => Boolean(s.warId));
    }
    if (filter === 'pending') {
      return all.filter(s => s.status === 'pending');
    }
    return all;
  }, [filter]);

  const toggle = (id: string, key: ReactionKey) =>
    setReactions(prev => {
      const mine = prev[id] ?? [];
      return {
        ...prev,
        [id]: mine.includes(key) ? mine.filter(k => k !== key) : [...mine, key],
      };
    });

  const unread = unreadCount();

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="label" tone="accent" uppercase>
            Witness
          </Text>
          <Text variant="displaySm" style={styles.title}>
            The feed
          </Text>
        </View>
        <IconButton
          accessibilityLabel={`Notifications, ${unread} unread`}
          variant="dark"
          size="md"
          onPress={() => navigation.navigate('Notifications')}>
          <Bell color={theme.colors.textInverse} size={20} />
        </IconButton>
      </View>

      <SegmentedControl<Filter>
        segments={[
          { value: 'all', label: 'All' },
          { value: 'war', label: 'Team War' },
          { value: 'pending', label: 'Needs proof' },
        ]}
        value={filter}
        onChange={setFilter}
        style={styles.tabs}
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="When your groups log workouts, their proof shows up in this feed."
        />
      ) : (
        <View style={styles.list}>
          {items.slice(0, 25).map(s => {
            const m = memberById(s.memberId);
            const pts = effortPoints(s.effort);
            const pending = s.status === 'pending';

            return (
              <Card key={s.id} variant="light" padding="base" style={styles.post}>
                <View style={styles.postHead}>
                  <Avatar name={m.name} size="md" />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{m.name}</Text>
                    <Text variant="caption" tone="muted">
                      {summarise(s)} · {relativeTime(s.createdAt)}
                    </Text>
                  </View>
                  <Text variant="statSm" tone={pending ? 'muted' : 'accent'}>
                    {pts}
                  </Text>
                </View>

                {s.note ? (
                  <Text variant="body" style={styles.note}>
                    {s.note}
                  </Text>
                ) : null}

                {/* PLACEHOLDER: real video thumbnail once uploads are wired. */}
                {s.warId ? (
                  <ImageBackground
                    source={remote(
                      placeholderPhoto(
                        s.kind === 'run' ? 'running' : s.kind === 'ride' ? 'cycling' : 'gym',
                        s.id,
                        640,
                        360,
                      ),
                    )}
                    imageStyle={{ borderRadius: theme.radius.lg }}
                    style={[
                      styles.media,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderRadius: theme.radius.lg,
                      },
                    ]}>
                    <IconButton accessibilityLabel="Play proof" variant="dark" size="md">
                      <Play
                        color={theme.colors.textInverse}
                        size={18}
                        fill={theme.colors.textInverse}
                      />
                    </IconButton>
                    <Chip
                      label={s.day === TODAY ? 'Today' : s.day}
                      variant="muted"
                      style={styles.mediaChip}
                    />
                  </ImageBackground>
                ) : null}

                <View style={styles.postFoot}>
                  <ReactionBar
                    counts={s.reactions}
                    mine={reactions[s.id]}
                    onToggle={key => toggle(s.id, key)}
                  />
                  {pending ? (
                    <Chip
                      label="Awaiting"
                      value={`${s.approvals.length}/2`}
                      variant="muted"
                      icon={<ShieldCheck color={theme.colors.textMuted} size={13} />}
                    />
                  ) : s.warId ? (
                    <Chip
                      label="Verified"
                      variant="muted"
                      icon={<Swords color={theme.colors.accent} size={13} />}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 12 },
  title: { marginTop: 6 },
  tabs: { marginTop: 20 },
  list: { marginTop: 16, rowGap: 12 },
  post: {},
  postHead: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  note: { marginTop: 12 },
  media: {
    height: 132,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaChip: { position: 'absolute', right: 10, bottom: 10 },
  postFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    columnGap: 8,
  },
});
