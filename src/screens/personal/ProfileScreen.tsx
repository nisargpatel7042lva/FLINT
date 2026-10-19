import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  LogOut,
  MessageSquareWarning,
  Palette,
  UserPlus,
  Users,
} from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatPill,
  Text,
} from '../../components';
import {
  APP_BUILD,
  APP_VERSION,
  clubColour,
  currentUser,
  ensureSignedIn,
  loadRuns,
  signOut,
  syncTone,
  type RunRecord,
  type Tone,
} from '../../services';
import { getSocialRepository } from '../../services/socialRepositoryProvider';
import type { PublicProfile } from '../../services/socialRepository';
import { useProfile, useSocial } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme, useThemeContext } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * You: who you are on Flint, what you have run, and the few settings a runner
 * actually changes.
 *
 * Everything here is the signed-in person's own data. The earlier version
 * showed a fixture profile, which meant every tester saw the same stranger's
 * name on their own profile.
 */
export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { uid, groups } = useSocial();
  const { update } = useProfile();
  const { tone, setTone } = useThemeContext();

  const [me, setMe] = useState<PublicProfile | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const user = currentUser();
  const anonymous = !user || user.isAnonymous;

  useEffect(() => {
    if (!uid) {
      return;
    }
    let alive = true;
    getSocialRepository()
      .getProfile(uid)
      .then(p => alive && setMe(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadRuns()
        .then(r => alive && setRuns(r))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  const stats = useMemo(() => {
    const onlyRuns = runs.filter(r => r.kind === 'run');
    const km = onlyRuns.reduce((s, r) => s + r.distanceKm, 0);
    const longest = onlyRuns.reduce((m, r) => Math.max(m, r.distanceKm), 0);
    return { km, count: onlyRuns.length, longest };
  }, [runs]);

  /*
   * Savage mode. Stored on the device, mirrored to the account so the server's
   * pushes match. Best effort on the mirror: if it fails the pushes stay warm,
   * which is the safe way to be wrong.
   */
  const chooseTone = (next: Tone) => {
    setTone(next);
    ensureSignedIn()
      .then(u => syncTone(u.uid, next))
      .catch(() => {});
  };

  const confirmSignOut = () =>
    Alert.alert(
      'Log out?',
      anonymous
        ? 'You have no account yet, so your runs and clubs on this phone cannot be recovered after logging out.'
        : 'Log back in any time with your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await signOut().catch(() => {});
            update({ completed: false });
            navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
          },
        },
      ],
    );

  const clubs = groups.filter(g => g.kind === 'club');
  const name = me?.name ?? 'Runner';

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={name} size="xl" ring />
        <View style={styles.flex}>
          <Text variant="h1" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="bodySm" tone="muted" numberOfLines={1}>
            {me?.handle ? `@${me.handle.replace(/^@/, '')}` : anonymous ? 'No account yet' : ''}
          </Text>
        </View>
      </View>

      {anonymous ? (
        <Card variant="accent" padding="base" radius="xl" style={styles.card}>
          <View style={styles.saveRow}>
            <UserPlus color={theme.colors.onAccent} size={20} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" tone="onAccent">
                Save your runs
              </Text>
              <Text variant="bodySm" tone="onAccent">
                Make an account so your runs and clubs survive a new phone.
              </Text>
            </View>
          </View>
          <Button
            label="Create account"
            size="sm"
            variant="dark"
            onPress={() => navigation.navigate('SignUp')}
            style={styles.saveButton}
          />
        </Card>
      ) : null}

      <SectionHeader title="Lifetime" subtitle="Runs recorded with Flint" style={styles.section} />
      <View style={styles.stats}>
        <StatPill value={stats.km.toFixed(1)} label="Km" variant="light" size="sm" />
        <StatPill value={stats.count} label="Runs" variant="light" size="sm" />
        <StatPill value={stats.longest.toFixed(1)} label="Longest" variant="light" size="sm" />
      </View>
      <ListRow
        filled
        title="All runs"
        leading={<CalendarDays color={theme.colors.accent} size={20} />}
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('History')}
        style={styles.row}
      />

      <SectionHeader title="Your clubs" style={styles.section} />
      {clubs.length === 0 ? (
        <ListRow
          filled
          title="Join or start a club"
          subtitle="Club runs light up the city map"
          leading={<Users color={theme.colors.accent} size={20} />}
          trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
          onPress={() => navigation.navigate('JoinClub')}
          style={styles.row}
        />
      ) : (
        clubs.map(c => (
          <ListRow
            key={c.id}
            filled
            title={c.name}
            subtitle={`${c.memberIds.length} members · code ${c.code}`}
            leading={<View style={[styles.swatch, { backgroundColor: clubColour(c.id) }]} />}
            trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
            onPress={() => navigation.navigate('GroupDetail', { groupId: c.id })}
            style={styles.row}
          />
        ))
      )}

      {/*
        How hard the app pushes back. Opt-in by design: savage is something a
        person asks for, never something they are dropped into. The examples
        are real lines from each voice, so the choice is made knowing exactly
        what it means.
      */}
      <SectionHeader
        title="How hard should we push?"
        subtitle="Predictions, steals and overtakes"
        style={styles.section}
      />
      <SegmentedControl<Tone>
        segments={[
          { value: 'warm', label: 'Push me' },
          { value: 'savage', label: 'Savage' },
        ]}
        value={tone}
        onChange={chooseTone}
        style={styles.toneControl}
      />
      <Text variant="bodySm" tone="muted" style={styles.toneExample}>
        {tone === 'savage'
          ? '“Your last 6 runs say you stop before 5 km. Prove us wrong.” Never about your body, always about the work.'
          : '“Your last 6 runs put your limit around 5 km today. Go past it.”'}
      </Text>

      <SectionHeader title="Settings" style={styles.section} />
      <ListRow
        filled
        title="Report a problem"
        subtitle="Goes straight to the people building Flint"
        leading={<MessageSquareWarning color={theme.colors.accent} size={20} />}
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('Feedback')}
        style={styles.row}
      />
      <ListRow
        filled
        title="Appearance"
        subtitle="Theme and accent colour"
        leading={<Palette color={theme.colors.accent} size={20} />}
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('Appearance')}
        style={styles.row}
      />
      <ListRow
        filled
        title="Gym workouts"
        subtitle="Strength sessions, for days off the road"
        leading={<Dumbbell color={theme.colors.accent} size={20} />}
        trailing={<ChevronRight color={theme.colors.textMuted} size={18} />}
        onPress={() => navigation.navigate('Train')}
        style={styles.row}
      />
      <ListRow
        filled
        title="Log out"
        leading={<LogOut color={theme.colors.accent} size={20} />}
        onPress={confirmSignOut}
        style={styles.row}
      />

      <Text variant="caption" tone="muted" align="center" style={styles.version}>
        Flint {APP_VERSION} ({APP_BUILD}) · beta
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 160 },
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', columnGap: 14, marginTop: 18 },
  card: { marginTop: 18 },
  saveRow: { flexDirection: 'row', columnGap: 12 },
  saveButton: { marginTop: 12, alignSelf: 'flex-start' },
  section: { marginTop: 28 },
  stats: { flexDirection: 'row', columnGap: 10 },
  row: { marginTop: 8 },
  swatch: { width: 20, height: 20, borderRadius: 6 },
  toneControl: { marginTop: 4 },
  toneExample: { marginTop: 10 },
  version: { marginTop: 32 },
});
