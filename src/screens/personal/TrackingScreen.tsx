import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Check, Footprints, Pause, Play, Square, Zap } from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  IconButton,
  RouteMap,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import {
  EMPTY_SUMMARY,
  TRAINING_TODAY,
  formatDuration,
  formatPace,
  startTracking,
  type LocationTracker,
  type TrackSummary,
} from '../../services';
import { useSessions } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Status = 'idle' | 'starting' | 'running' | 'paused' | 'denied' | 'saved';

const KIND_LABEL = { run: 'Run', walk: 'Walk' } as const;

/**
 * Calories per kilometre, roughly, for a 70kg adult.
 *
 * Running costs about the same per kilometre regardless of pace — you pay for
 * the distance, not the speed — which is why these are per-km and not per
 * minute like the gym sessions.
 */
const KCAL_PER_KM = { run: 62, walk: 48 } as const;

/**
 * Live GPS tracking for a run or a walk.
 *
 * Distance leads, because distance is the thing people quote back to
 * themselves. Pace comes from moving time rather than the wall clock, so
 * stopping at a junction does not quietly make you look slower.
 */
export function TrackingScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Tracking'>>();
  const kind = route.params?.kind ?? 'run';

  const { addSession } = useSessions();

  const [status, setStatus] = useState<Status>('idle');
  const [summary, setSummary] = useState<TrackSummary>(EMPTY_SUMMARY);
  const [elapsed, setElapsed] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tracker = useRef<LocationTracker | null>(null);

  const running = status === 'running';

  /*
   * The clock ticks locally rather than being read off the GPS fixes.
   *
   * Fixes arrive every few seconds at best, and stop entirely when someone
   * stands still — a timer driven by them would visibly freeze while the
   * person is very much still out there.
   */
  useEffect(() => {
    if (!running) {
      return;
    }
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  /*
   * Foreground-only location means a backgrounded app stops receiving fixes.
   * Auto-pausing on the way out is the honest response: the alternative is a
   * clock that keeps counting over a route that stopped being recorded.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active' && tracker.current && !tracker.current.isPaused()) {
        tracker.current.pause();
        setStatus(s => (s === 'running' ? 'paused' : s));
      }
    });
    return () => sub.remove();
  }, []);

  // Stop the watch if the screen goes away mid-session; a live GPS subscription
  // outliving its screen is a battery drain nobody can see or cancel.
  useEffect(
    () => () => {
      tracker.current?.stop();
      tracker.current = null;
    },
    [],
  );

  const begin = useCallback(async () => {
    setStatus('starting');
    const t = await startTracking(setSummary);
    if (!t) {
      setStatus('denied');
      return;
    }
    tracker.current = t;
    setElapsed(0);
    setStatus('running');
  }, []);

  const togglePause = () => {
    if (!tracker.current) {
      return;
    }
    if (tracker.current.isPaused()) {
      tracker.current.resume();
      setStatus('running');
    } else {
      tracker.current.pause();
      setStatus('paused');
    }
  };

  const kcal = useMemo(() => {
    const fromDistance = Math.round(summary.distanceKm * KCAL_PER_KM[kind]);
    // Indoors or with no fix yet, distance is 0 and a time-based estimate is
    // the only thing left that is not simply a lie.
    return fromDistance > 0 ? fromDistance : Math.round((elapsed / 60) * 6);
  }, [summary.distanceKm, elapsed, kind]);

  const finish = () => {
    const final = tracker.current?.stop() ?? summary;
    tracker.current = null;
    setSummary(final);
    setStatus('saved');

    const minutes = Math.max(1, Math.round(elapsed / 60));
    addSession({
      day: TRAINING_TODAY,
      title:
        final.distanceKm > 0
          ? `${final.distanceKm.toFixed(2)} km ${KIND_LABEL[kind]}`
          : `${minutes}-minute ${KIND_LABEL[kind]}`,
      focus: 'cardio',
      minutes,
      // A tracked outing has no sets. One-of-one keeps it a completed session
      // everywhere that reads completion as a ratio.
      completedSets: 1,
      totalSets: 1,
      kcal: final.distanceKm > 0 ? Math.round(final.distanceKm * KCAL_PER_KM[kind]) : kcal,
    }).catch(e => setSaveError(e instanceof Error ? e.message : String(e)));
  };

  const done = status === 'saved';

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
        <Chip
          label={KIND_LABEL[kind]}
          variant={running ? 'accent' : 'muted'}
          icon={
            kind === 'run' ? (
              <Zap color={running ? theme.colors.onAccent : theme.colors.textMuted} size={14} />
            ) : (
              <Footprints
                color={running ? theme.colors.onAccent : theme.colors.textMuted}
                size={14}
              />
            )
          }
        />
      </View>

      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        {done ? 'Session saved' : running ? 'Recording' : status === 'paused' ? 'Paused' : 'Ready'}
      </Text>

      {/* Distance leads. It is the number people repeat to themselves. */}
      <View style={styles.headline}>
        <Text variant="displayLg">{summary.distanceKm.toFixed(2)}</Text>
        <Text variant="h2" tone="muted" style={styles.unit}>
          km
        </Text>
      </View>

      <Card variant="dark" padding="base" radius="xxl" style={styles.stats}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text variant="label" tone="inverseMuted" uppercase>
              Time
            </Text>
            <Text variant="statSm" tone="inverse" style={styles.statValue}>
              {formatDuration(elapsed)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="label" tone="inverseMuted" uppercase>
              Pace
            </Text>
            <Text variant="statSm" tone="inverse" style={styles.statValue}>
              {formatPace(summary.paceMinPerKm)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="label" tone="inverseMuted" uppercase>
              Kcal
            </Text>
            <Text variant="statSm" tone="inverse" style={styles.statValue}>
              {kcal}
            </Text>
          </View>
        </View>
      </Card>

      <RouteMap
        segments={summary.segments}
        height={210}
        showMarkers={done}
        style={styles.map}
      />

      {status === 'denied' ? (
        <Card variant="light" padding="base" radius="xl" style={styles.notice}>
          <Text variant="bodyStrong">Location is off</Text>
          <Text variant="bodySm" tone="muted" style={styles.noticeBody}>
            Kasrat needs location to measure distance. Turn it on in Settings and
            come back — nothing is recorded until you press start.
          </Text>
        </Card>
      ) : null}

      {saveError ? (
        <Card variant="light" padding="base" radius="xl" style={styles.notice}>
          <Text variant="bodyStrong">Couldn't save that one</Text>
          <Text variant="bodySm" tone="muted" style={styles.noticeBody}>
            {saveError}
          </Text>
        </Card>
      ) : null}

      {summary.splits.length > 0 ? (
        <View>
          <SectionHeader title="Splits" subtitle="Per kilometre" style={styles.section} />
          <Card variant="light" padding="base" radius="xl">
            <View style={styles.splits}>
              {summary.splits.map(s => (
                <View key={s.km} style={styles.splitRow}>
                  <Text variant="bodyStrong" style={styles.splitKm}>
                    {s.km} km
                  </Text>
                  <Text variant="bodySm" tone="muted">
                    {formatDuration(s.seconds)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      <View style={styles.controls}>
        {status === 'idle' || status === 'denied' ? (
          <Button
            label={status === 'denied' ? 'Try again' : `Start ${KIND_LABEL[kind].toLowerCase()}`}
            size="lg"
            fullWidth
            onPress={begin}
            iconLeft={<Play color={theme.colors.onAccent} size={18} />}
          />
        ) : null}

        {status === 'starting' ? (
          <Button label="Finding GPS…" size="lg" fullWidth disabled />
        ) : null}

        {running || status === 'paused' ? (
          <>
            <Button
              label={status === 'paused' ? 'Resume' : 'Pause'}
              size="lg"
              fullWidth
              variant={status === 'paused' ? 'primary' : 'outline'}
              onPress={togglePause}
              iconLeft={
                status === 'paused' ? (
                  <Play color={theme.colors.onAccent} size={18} />
                ) : (
                  <Pause color={theme.colors.text} size={18} />
                )
              }
            />
            <Button
              label="Finish"
              size="lg"
              fullWidth
              variant="ghost"
              onPress={finish}
              iconLeft={<Square color={theme.colors.accent} size={16} />}
            />
          </>
        ) : null}

        {done ? (
          <Button
            label="Done"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate('Tabs', { screen: 'History' })}
            iconLeft={<Check color={theme.colors.onAccent} size={18} />}
          />
        ) : null}
      </View>
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
  eyebrow: { marginTop: 22 },
  headline: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, marginTop: 2 },
  unit: { marginBottom: 4 },
  stats: { marginTop: 18 },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1 },
  statValue: { marginTop: 4 },
  map: { marginTop: 16 },
  notice: { marginTop: 16 },
  noticeBody: { marginTop: 4 },
  section: { marginTop: 28 },
  splits: { rowGap: 10 },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitKm: { minWidth: 70 },
  controls: { marginTop: 28, rowGap: 10 },
});
