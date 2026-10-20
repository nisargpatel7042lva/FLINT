import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Smartphone, Trophy, X } from 'lucide-react-native';

import { Button, Card, IconButton, ProgressRing, Screen, Text } from '../../components';
import {
  createRepCounter,
  formatDuration,
  keepAwake,
  loadPushups,
  pushupStats,
  savePushups,
  todayKey,
  watchProximity,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme, useThemeContext } from '../../theme';

type Phase = 'setup' | 'live' | 'done';

const TARGETS = [10, 15, 25, 50] as const;

const buzz = (ms: number) => {
  try {
    Vibration.vibrate(ms);
  } catch {
    // No motor, or no permission: counting does not depend on it.
  }
};

/**
 * Push-up challenge: the phone counts, you push.
 *
 * Put the phone flat on the floor under your chest. The proximity sensor —
 * the one that turns the screen off during calls — sees your chest come down,
 * and every time it does, that is a rep. The number is huge, it pulses on
 * every rep, the phone buzzes, and a ring fills toward the target. Phones
 * without the sensor (or anyone who prefers it) tap the screen with their nose.
 *
 * Opened from the doom-scroll notification as "15 right now", or from Train.
 */
export function PushupScreen() {
  const theme = useTheme();
  const { tone } = useThemeContext();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Pushups'>>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const fromScroll = route.params?.from === 'scroll';

  const [phase, setPhase] = useState<Phase>('setup');
  const [target, setTarget] = useState<number>(fromScroll ? 15 : 25);
  const [reps, setReps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [sensor, setSensor] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ best: 0, today: 0 });

  const counter = useRef(createRepCounter(() => {}));
  const stopSensor = useRef<(() => void) | null>(null);
  const startedAt = useRef(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    loadPushups()
      .then(sets => setStats(pushupStats(sets, todayKey())))
      .catch(() => {});
  }, []);

  const onRep = useCallback(
    (n: number) => {
      setReps(n);
      buzz(n % 5 === 0 ? 120 : 35);
      if (!reduced) {
        pulse.value = withSequence(withTiming(1.18, { duration: 90 }), withTiming(1, { duration: 160 }));
      }
    },
    [pulse, reduced],
  );

  const finish = useCallback(async () => {
    stopSensor.current?.();
    stopSensor.current = null;
    keepAwake(false).catch(() => {});
    const done = counter.current.reps;
    const secs = Math.round((Date.now() - startedAt.current) / 1000);
    setSeconds(secs);
    if (done > 0) {
      const all = await savePushups({ reps: done, seconds: secs, at: new Date().toISOString() });
      setStats(pushupStats(all, todayKey()));
    }
    setPhase('done');
  }, []);

  const start = async () => {
    counter.current = createRepCounter(onRep);
    setReps(0);
    setSeconds(0);
    startedAt.current = Date.now();
    setPhase('live');
    keepAwake(true).catch(() => {});
    const stop = await watchProximity(near => counter.current.reading(near, Date.now()));
    stopSensor.current = stop;
    setSensor(stop !== null);
  };

  // The clock, and the finish line.
  useEffect(() => {
    if (phase !== 'live') {
      return;
    }
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'live' && target > 0 && reps >= target) {
      buzz(400);
      finish().catch(() => {});
    }
  }, [phase, reps, target, finish]);

  // Leaving mid-set must not leave the sensor running or the screen pinned on.
  useEffect(
    () => () => {
      stopSensor.current?.();
      keepAwake(false).catch(() => {});
    },
    [],
  );

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (phase === 'live') {
    const left = Math.max(0, target - reps);
    return (
      <Pressable
        style={[styles.live, { backgroundColor: theme.colors.accent, paddingTop: insets.top + 12 }]}
        onPress={() => counter.current.tap(Date.now())}
        accessibilityRole="button"
        accessibilityLabel={`${reps} push-ups. Tap to count one.`}>
        <View style={styles.liveTop}>
          <IconButton accessibilityLabel="Stop" variant="dark" size="md" onPress={() => finish()}>
            <X color={theme.colors.textInverse} size={20} />
          </IconButton>
          <Text variant="label" tone="onAccent" uppercase>
            {sensor ? 'Chest to the phone' : 'Tap the screen with your nose'}
          </Text>
        </View>
        <View style={styles.liveCentre}>
          <ProgressRing
            value={reps}
            max={Math.max(1, target)}
            size={280}
            strokeWidth={14}
            trackColor="rgba(255,255,255,0.25)"
            color="#FFFFFF">
            <Animated.View style={pulseStyle}>
              <Text variant="countdown" tone="onAccent">
                {reps}
              </Text>
            </Animated.View>
          </ProgressRing>
          <Text variant="h2" tone="onAccent" style={styles.toGo}>
            {left > 0 ? `${left} to go` : 'Done!'}
          </Text>
        </View>
        <Text variant="statMd" tone="onAccent" align="center" style={styles.clock}>
          {formatDuration(seconds)}
        </Text>
      </Pressable>
    );
  }

  if (phase === 'done') {
    const done = counter.current.reps;
    const hit = done >= target;
    const best = done > 0 && done >= stats.best;
    return (
      <Screen padding="lg" contentContainerStyle={styles.doneWrap}>
        <View style={styles.flex} />
        <Trophy color={theme.colors.accent} size={48} />
        <Text variant="displayLg" align="center" style={styles.doneTitle}>
          {done} push-up{done === 1 ? '' : 's'}
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.doneBody}>
          {hit
            ? fromScroll
              ? tone === 'savage'
                ? 'See? That beat scrolling. Now go outside.'
                : 'Better than another 15 minutes of feed. Nice.'
              : `${formatDuration(seconds)}. ${best ? 'A new best.' : `Your best is ${stats.best}.`}`
            : tone === 'savage'
            ? `Stopped ${target - done} short. Your arms gave up before you did?`
            : `${target - done} short of ${target}. Finish them when you're ready.`}
        </Text>
        <Card variant="light" padding="base" radius="xl" style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.flex}>
              <Text variant="statMd">{stats.today}</Text>
              <Text variant="label" tone="muted" uppercase>
                Today
              </Text>
            </View>
            <View style={styles.flex}>
              <Text variant="statMd">{stats.best}</Text>
              <Text variant="label" tone="muted" uppercase>
                Best set
              </Text>
            </View>
          </View>
        </Card>
        <View style={styles.flex} />
        <Button label={hit ? 'Another set' : 'Finish them'} size="lg" fullWidth onPress={start} />
        <Button
          label="Done"
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.goBack()}
          style={styles.ghost}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <IconButton accessibilityLabel="Go back" variant="muted" size="md" onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>
      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        {fromScroll ? 'Scroll payback' : 'Push-up challenge'}
      </Text>
      <Text variant="displaySm" style={styles.title}>
        {fromScroll
          ? tone === 'savage'
            ? 'Phone down.\nFloor. Now.'
            : 'Swap the feed\nfor 15 push-ups'
          : 'How many\ncan you do?'}
      </Text>

      <Card variant="dark" padding="base" radius="xl" style={styles.how}>
        <View style={styles.howRow}>
          <Smartphone color={theme.colors.accent} size={28} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" tone="inverse">
              Phone on the floor, under your chest
            </Text>
            <Text variant="bodySm" tone="inverseMuted">
              Screen up. Every time your chest comes down to it, Flint counts. No sensor? Tap the
              screen with your nose.
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="bodyStrong" style={styles.q}>
        Target
      </Text>
      <View style={styles.targets}>
        {TARGETS.map(t => (
          <Button
            key={t}
            label={String(t)}
            size="md"
            variant={target === t ? 'primary' : 'outline'}
            onPress={() => setTarget(t)}
          />
        ))}
      </View>

      <View style={styles.statsLine}>
        <Text variant="bodySm" tone="muted">
          Today: {stats.today} · Best set: {stats.best}
        </Text>
      </View>

      <Button label={`Start · ${target} push-ups`} size="lg" fullWidth onPress={start} style={styles.startBtn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  eyebrow: { marginTop: 20 },
  title: { marginTop: 6 },
  how: { marginTop: 22 },
  howRow: { flexDirection: 'row', columnGap: 14 },
  q: { marginTop: 24, marginBottom: 10 },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statsLine: { marginTop: 18 },
  startBtn: { marginTop: 24 },
  flex: { flex: 1 },
  live: { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  liveTop: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  liveCentre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toGo: { marginTop: 18 },
  clock: { opacity: 0.9 },
  doneWrap: { flex: 1, alignItems: 'center', paddingBottom: 28 },
  doneTitle: { marginTop: 16 },
  doneBody: { marginTop: 8, maxWidth: 320 },
  statsCard: { marginTop: 24, alignSelf: 'stretch' },
  statsRow: { flexDirection: 'row' },
  ghost: { marginTop: 6 },
});
