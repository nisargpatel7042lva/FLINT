import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { ArrowRight, Check, Clock, Flame } from 'lucide-react-native';

import {
  AnimatedCounter,
  Button,
  Card,
  Char,
  Chip,
  ListRow,
  Screen,
  Text,
} from '../../components';
import { generateWorkout } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { duration, useTheme } from '../../theme';

type Phase = 'workout' | 'ignited';

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Steps 5 and 6: the generated session, and the first win.
 *
 * These are one screen on purpose. Completing the first exercise is the
 * emotional beat the whole flow exists for, and cutting to a new screen at that
 * moment would break it — the ignition happens in place, with Char going from
 * glowing to celebrating and the streak counting up from zero.
 *
 * Account creation is deliberately NOT here. It comes after, once there is
 * something worth saving.
 */
export function FirstWorkoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'FirstWorkout'>>();
  const minutes = route.params?.minutes ?? 10;

  // TODO: real generation — see services/onboarding.ts.
  const workout = useMemo(() => generateWorkout(minutes), [minutes]);

  const [phase, setPhase] = useState<Phase>('workout');
  const [streak, setStreak] = useState(0);

  const first = workout.exercises[0];

  const complete = () => {
    setPhase('ignited');
    // Let Char's pop land first, then run the counter into it.
    setTimeout(() => setStreak(1), duration.base);
  };

  if (phase === 'ignited') {
    return (
      <Screen padding="lg" contentContainerStyle={styles.content}>
        <View style={styles.center}>
          <Char state="celebrating" size={180} />

          <Animated.View entering={FadeInDown.delay(duration.base).duration(duration.slow)}>
            <Text variant="displaySm" align="center" style={styles.igniteTitle}>
              That's one.
            </Text>
          </Animated.View>

          {/* The streak object itself — this is what the account will save. */}
          <Animated.View
            entering={ZoomIn.delay(duration.slow).duration(duration.base)}
            style={styles.streakWrap}>
            <Card variant="dark" padding="lg" radius="xxl" style={styles.streakCard}>
              <View style={styles.streakRow}>
                <Flame color={theme.colors.accent} size={30} />
                <AnimatedCounter
                  value={streak}
                  variant="statLg"
                  tone="inverse"
                  durationMs={520}
                />
              </View>
              <Text variant="label" tone="inverseMuted" uppercase align="center">
                Day streak
              </Text>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(duration.deliberate).duration(duration.slow)}>
            <Text variant="body" tone="muted" align="center" style={styles.igniteBody}>
              Char is lit. It stays that way as long as you keep showing up —
              and it dims if you don't.
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(duration.deliberate + duration.base)}>
          <Button
            label="Save my streak"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate('SignUp')}
            iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
          />
          <Button
            label="Not yet"
            variant="ghost"
            size="md"
            fullWidth
            style={styles.skip}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
          />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="label" tone="accent" uppercase>
            Built for you
          </Text>
          <Text variant="displaySm" style={styles.title}>
            {workout.title}
          </Text>
        </View>
        <Char state="glowing" size={84} />
      </View>

      <View style={styles.metaRow}>
        <Chip
          label="Time"
          value={`${workout.minutes} min`}
          variant="muted"
          icon={<Clock color={theme.colors.textMuted} size={14} />}
        />
        <Chip
          label="Moves"
          value={`${workout.exercises.length}`}
          variant="muted"
        />
      </View>

      {/* The first exercise is pulled out — the goal is one completion, now. */}
      <Card variant="accent" padding="lg" radius="xxl" style={styles.firstCard}>
        <Text variant="label" tone="onAccent" uppercase>
          Start here
        </Text>
        <Text variant="h1" tone="onAccent" style={styles.firstName}>
          {first.name}
        </Text>
        <Text variant="bodySm" tone="onAccent" style={styles.firstDetail}>
          {first.detail} · {mmss(first.seconds)}
        </Text>
        <Button
          label="I did it"
          variant="dark"
          size="lg"
          fullWidth
          style={styles.firstCta}
          onPress={complete}
          iconLeft={<Check color={theme.colors.textInverse} size={20} strokeWidth={3} />}
        />
      </Card>

      <Text variant="bodySm" tone="muted" style={styles.restLabel}>
        Then, when you're ready
      </Text>

      <View style={styles.rest}>
        {workout.exercises.slice(1).map((e, i) => (
          <ListRow
            key={e.id}
            title={e.name}
            subtitle={e.detail}
            leading={
              <Text variant="statSm" tone="muted">
                {i + 2}
              </Text>
            }
            trailing={
              <Text variant="caption" tone="muted">
                {mmss(e.seconds)}
              </Text>
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  scrollContent: { paddingBottom: 48 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, columnGap: 12 },
  title: { marginTop: 6 },
  metaRow: { flexDirection: 'row', columnGap: 10, marginTop: 16 },
  firstCard: { marginTop: 20 },
  firstName: { marginTop: 8 },
  firstDetail: { marginTop: 4 },
  firstCta: { marginTop: 20 },
  restLabel: { marginTop: 28 },
  rest: { marginTop: 4 },
  igniteTitle: { marginTop: 44 },
  streakWrap: { marginTop: 20 },
  streakCard: { minWidth: 200 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 12,
  },
  igniteBody: { marginTop: 24, maxWidth: 320 },
  skip: { marginTop: 4 },
});
