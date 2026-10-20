import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppState,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import RNShare from 'react-native-share';
import type { ViewShotRef } from 'react-native-view-shot';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import {
  ArrowLeft,
  BatteryCharging,
  Share2,
  Check,
  Compass,
  Footprints,
  Play,
  Zap,
} from 'lucide-react-native';

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
  explorationSummary,
  loadExplored,
  recordTrack,
  saveExplored,
  todayKey,
  formatDuration,
  checkPlausible,
  cityCellsForRun,
  clubColour,
  judge,
  regionForRun,
  kcalFor,
  loadRuns,
  predict,
  predictionLine,
  runId,
  saveRun,
  saveRoute,
  encodeRoute,
  verdictLine,
  type Prediction,
  isBatteryRestricted,
  movingSeconds,
  openBatterySettings,
  resumeActiveRun,
  startRun,
  requestLocationPermission,
  askForNotifications,
  waitForFix,
  type LiveRun,
  type RunKind,
  type TrackSummary,
} from '../../services';
import { useProfile, useSessions, useSocial } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme, useThemeContext } from '../../theme';
import { Countdown } from './run/Countdown';
import { LiveRunView } from './run/LiveRunView';
import { RunShareCard } from './run/RunShareCard';

/**
 * A save failure, said so a tester knows what to do.
 *
 * The run itself is always kept on the phone first; what failed is the copy
 * to the server. Saying "permission-denied" makes people think the run is lost.
 */
function saveErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Your run is saved on this phone. It will sync when you are back online.';
  }
  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Your run is saved on this phone, but the server refused the copy. Tap Report a problem in your profile so we can fix it.';
  }
  return 'Your run is saved on this phone, but did not reach the server. Try again later.';
}

type Status =
  | 'loading'
  | 'idle'
  /** Waiting for a GPS fix good enough to start on. */
  | 'acquiring'
  /** GPS never got good enough; the runner decides. */
  | 'weakGps'
  | 'countdown'
  | 'starting'
  | 'running'
  | 'paused'
  | 'denied'
  | 'failed'
  | 'saved';

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
  const [kind, setKind] = useState<RunKind>(route.params?.kind ?? 'run');

  const { addSession } = useSessions();
  const { profile } = useProfile();

  // 'loading' until we know whether a run is already being recorded.
  const [status, setStatus] = useState<Status>('loading');
  const [summary, setSummary] = useState<TrackSummary>(EMPTY_SUMMARY);
  const [elapsed, setElapsed] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** When the run started — half of the run's id, so it is set once, at start. */
  const startedAt = useRef(0);
  const { groups, postRun, uid } = useSocial();
  const { tone } = useThemeContext();

  /*
   * The call against the runner, made before they start.
   *
   * Fixed at the moment they press start rather than recomputed: the finish
   * screen has to judge them against the claim they actually read, not one
   * that quietly moved while they were out.
   */
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const lockedPrediction = useRef<Prediction | null>(null);
  useEffect(() => {
    let alive = true;
    loadRuns()
      .then(runs => alive && setPrediction(predict(runs, kind)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind]);
  /**
   * What happened to the club post, said plainly on the finish screen.
   *
   * A run that silently failed to reach the club is worse than one that was
   * never meant to: the runner assumes their crew saw it.
   */
  const [clubPost, setClubPost] = useState<
    | { state: 'posted'; names: string[] }
    | { state: 'refused'; reason: string }
    | { state: 'failed' }
    | null
  >(null);
  /** What this session added to the explored map, filled in on finish. */
  const [explored, setExplored] = useState<{
    discovered: number;
    text: string;
  } | null>(null);

  const live = useRef<LiveRun | null>(null);
  const shareRef = useRef<ViewShotRef>(null);
  /** Blocks this run lit, trimmed for privacy: what the share card draws. */
  const [lit, setLit] = useState<string[]>([]);
  const { width: screenW } = useWindowDimensions();
  const cardWidth = Math.min(420, screenW - 48);
  const clubs = useMemo(() => groups.filter(g => g.kind === 'club'), [groups]);
  const clubColourFor = clubs[0]
    ? clubColour(clubs[0].id)
    : theme.colors.accent;

  const shareRun = async () => {
    const uri = await shareRef.current?.capture?.();
    if (!uri) {
      return;
    }
    const n = lit.length;
    await RNShare.open({
      url: uri.startsWith('file://') ? uri : `file://${uri}`,
      type: 'image/png',
      message:
        n > 0
          ? `Lit ${n} block${n === 1 ? '' : 's'}${
              clubs[0] ? ` for ${clubs[0].name}` : ''
            } on Flint. Come run with us: https://use-flint.web.app`
          : `${summary.distanceKm.toFixed(
              2,
            )} km on Flint. https://use-flint.web.app`,
      failOnCancel: false,
    });
  };
  const [batteryRestricted, setBatteryRestricted] = useState(false);

  const running = status === 'running';
  const recording = status === 'running' || status === 'paused';

  /*
   * Reattach to a run already in progress.
   *
   * The run is recorded natively, so leaving this screen, or the app being
   * killed, does not end it. Coming back must land on the same run, not offer
   * a fresh start over the top of one still recording.
   */
  useEffect(() => {
    let alive = true;
    resumeActiveRun()
      .then(run => {
        if (!alive) {
          return;
        }
        if (!run) {
          setStatus('idle');
          return;
        }
        const s = run.status();
        live.current = run;
        startedAt.current = s.startedAt;
        setKind(s.kind);
        setSummary(run.summary());
        setElapsed(movingSeconds(s, Date.now()));
        setStatus(s.paused ? 'paused' : 'running');
      })
      .catch(() => alive && setStatus('idle'));
    isBatteryRestricted()
      .then(r => alive && setBatteryRestricted(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /*
   * The clock and the route, refreshed once a second.
   *
   * Time comes from the recorder's timestamps, not from counting ticks: ticks
   * stop while the phone is in a pocket, timestamps do not.
   */
  const refresh = useCallback(async () => {
    const run = live.current;
    if (!run) {
      return;
    }
    const next = await run.sync();
    setSummary(next);
    setElapsed(movingSeconds(run.status(), Date.now()));
  }, []);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 1000);
    return () => clearInterval(t);
  }, [recording, refresh]);

  // Back from the lock screen: catch up at once rather than on the next tick.
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        refresh().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [refresh]);

  /** The fix wait in progress, so leaving the screen can stop it. */
  const fixWait = useRef<{ cancel: () => void } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  useEffect(() => () => fixWait.current?.cancel(), []);

  /*
   * Start, step one: a usable fix.
   *
   * Permission first (the wait needs it), then up to 25 seconds for GPS to
   * settle. A good fix goes straight to the countdown; a weak one asks, rather
   * than silently starting a run whose first point is in the wrong street.
   */
  const begin = useCallback(async () => {
    if (!(await requestLocationPermission())) {
      setStatus('denied');
      return;
    }
    await askForNotifications();
    setAccuracy(null);
    setStatus('acquiring');
    const wait = waitForFix(25_000, setAccuracy);
    fixWait.current = wait;
    const fix = await wait.promise;
    fixWait.current = null;
    setStatus(s => (s !== 'acquiring' ? s : fix.ok ? 'countdown' : 'weakGps'));
  }, []);

  /** Start, step two: after the countdown, the recorder itself. */
  const startRecording = useCallback(async () => {
    setStatus('starting');
    const result = await startRun(kind);
    if (!result.ok) {
      setStatus(result.reason);
      return;
    }
    live.current = result.run;
    startedAt.current = result.run.status().startedAt;
    lockedPrediction.current = prediction;
    setElapsed(0);
    setStatus('running');
  }, [kind, prediction]);

  const togglePause = async () => {
    const run = live.current;
    if (!run) {
      return;
    }
    if (run.status().paused) {
      await run.resume();
      setStatus('running');
    } else {
      await run.pause();
      setStatus('paused');
    }
    setElapsed(movingSeconds(run.status(), Date.now()));
  };

  const allowBackground = async () => {
    await openBatterySettings();
    // They come back from Settings; check again rather than assume.
    setTimeout(() => {
      isBatteryRestricted()
        .then(setBatteryRestricted)
        .catch(() => {});
    }, 1500);
  };

  const kcal = useMemo(() => {
    const fromDistance = Math.round(summary.distanceKm * KCAL_PER_KM[kind]);
    // Indoors or with no fix yet, distance is 0 and a time-based estimate is
    // the only thing left that is not simply a lie. With a body weight on the
    // profile that estimate is MET-scaled rather than a flat guess.
    return fromDistance > 0
      ? fromDistance
      : kcalFor(profile, elapsed / 60, kind);
  }, [summary.distanceKm, elapsed, kind, profile]);

  const finish = async () => {
    const run = live.current;
    const finalElapsed = run
      ? movingSeconds(run.status(), Date.now())
      : elapsed;
    const final = run ? await run.finish() : summary;
    live.current = null;
    setElapsed(finalElapsed);
    setSummary(final);
    setLit(cityCellsForRun(final.segments));
    setStatus('saved');

    /*
     * Fold the route into the explored map.
     *
     * Deliberately after the session is saved and not awaited: uncovering
     * ground is the reward, and a storage hiccup must never be the reason a
     * finished workout fails to log.
     */
    loadExplored()
      .then(current => {
        const { discovered, revisited, next } = recordTrack(
          current,
          final.segments,
        );
        setExplored({
          discovered: discovered.length,
          text: explorationSummary(discovered.length, revisited.length),
        });
        return saveExplored(next);
      })
      .catch(() => {});

    /*
     * The run record: personal history for predictions, and the club post.
     *
     * Checked for plausibility first. A drive logged as a run would otherwise
     * sit on top of every club board the runner belongs to — and the rules
     * would refuse it server-side anyway, so checking here is what lets the
     * screen explain WHY instead of reporting a vague failure.
     */
    if (final.distanceKm >= 0.1 && startedAt.current > 0) {
      const record = {
        id: runId(uid || 'me', startedAt.current),
        kind,
        distanceKm: Math.round(final.distanceKm * 100) / 100,
        durationSec: Math.max(1, finalElapsed),
        // Read now, not at app start: a run that finishes after midnight in a
        // session opened yesterday must not be filed under yesterday.
        day: todayKey(),
        startedAt: new Date(startedAt.current).toISOString(),
      };
      const verdict = checkPlausible(record);
      const cells = cityCellsForRun(final.segments);

      /*
       * Always kept on the phone, route included. A refused run is flagged
       * rather than dropped: it is still the runner's run, it just does not
       * count for the club. Dropping it is how real runs spoiled by one GPS
       * glitch used to vanish from history altogether.
       */
      saveRun({
        ...record,
        flagged: verdict.ok ? undefined : verdict.reason,
        litBlocks: verdict.ok ? cells.length : 0,
        movingSec: final.movingSeconds,
      }).catch(() => {});
      saveRoute(record.id, encodeRoute(final.segments)).catch(() => {});

      if (!verdict.ok) {
        setClubPost({ state: 'refused', reason: verdict.reason });
      } else {
        if (groups.length > 0) {
          const region = regionForRun(final.segments);
          postRun({
            startedAtMs: startedAt.current,
            kind: record.kind,
            distanceKm: record.distanceKm,
            durationSec: record.durationSec,
            day: record.day,
            city: cells.length > 0 && region ? { cells, region } : undefined,
          })
            .then(() =>
              setClubPost({ state: 'posted', names: groups.map(g => g.name) }),
            )
            .catch(() => setClubPost({ state: 'failed' }));
        }
      }
    }

    const minutes = Math.max(1, Math.round(finalElapsed / 60));
    addSession({
      day: todayKey(),
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
      kcal:
        final.distanceKm > 0
          ? Math.round(final.distanceKm * KCAL_PER_KM[kind])
          : kcal,
    }).catch(e => setSaveError(saveErrorMessage(e)));
  };

  const confirmFinish = () => {
    // Under 100 m nothing is posted, so say so before ending rather than after.
    // The hold already proved intent for a real run; this catches the false start.
    if (summary.distanceKm < 0.1) {
      Alert.alert(
        'Finish now?',
        'Under 100 m does not count toward your club.',
        [
          { text: 'Keep going', style: 'cancel' },
          {
            text: 'Finish',
            style: 'destructive',
            onPress: () => finish().catch(() => {}),
          },
        ],
      );
      return;
    }
    finish().catch(() => {});
  };

  const done = status === 'saved';

  if (status === 'countdown') {
    return <Countdown onDone={startRecording} />;
  }

  if (recording) {
    return (
      <LiveRunView
        summary={summary}
        elapsed={elapsed}
        kcal={kcal}
        paused={status === 'paused'}
        kind={kind}
        onTogglePause={() => {
          togglePause().catch(() => {});
        }}
        onFinish={confirmFinish}
        onMinimise={() => navigation.goBack()}
      />
    );
  }

  /* Judged only when the run is real and was not refused as implausible. */
  const call = done ? lockedPrediction.current : prediction;
  const verdict =
    done && call && clubPost?.state !== 'refused' && summary.distanceKm >= 0.1
      ? judge(call, summary.distanceKm)
      : null;

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        <Chip
          label={KIND_LABEL[kind]}
          variant={running ? 'accent' : 'muted'}
          icon={
            kind === 'run' ? (
              <Zap
                color={running ? theme.colors.onAccent : theme.colors.textMuted}
                size={14}
              />
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
        {done
          ? 'Session saved'
          : status === 'acquiring' || status === 'weakGps'
          ? 'Getting ready'
          : 'Ready'}
      </Text>

      {/*
        The call. Before the run it is the dare; after it, the verdict. It sits
        right under the eyebrow because it is the thing to beat, and the
        distance below it is the score.
      */}
      {call && (status === 'idle' || done) ? (
        <Card
          variant={verdict?.beaten ? 'accent' : 'light'}
          padding="base"
          radius="xl"
          style={styles.call}
        >
          <Text
            variant="label"
            tone={verdict?.beaten ? 'onAccent' : 'accent'}
            uppercase
          >
            {verdict
              ? verdict.beaten
                ? 'Proved us wrong'
                : 'Our call stood'
              : 'Our call'}
          </Text>
          <Text
            variant="bodyStrong"
            tone={verdict?.beaten ? 'onAccent' : 'default'}
            style={styles.callText}
          >
            {verdict ? verdictLine(verdict, tone) : predictionLine(call, tone)}
          </Text>
        </Card>
      ) : null}

      {/*
        The share card leads a finished run. Posting it is how a club's
        friends hear about Flint, so it sits where the thumb already is.
      */}
      {done ? (
        <View style={styles.share}>
          <RunShareCard
            ref={shareRef}
            width={cardWidth}
            cells={lit}
            colour={clubColourFor}
            clubName={clubs[0]?.name ?? null}
            distanceKm={summary.distanceKm}
            durationSec={elapsed}
            paceMinPerKm={summary.paceMinPerKm}
            date={new Date(startedAt.current || Date.now())}
          />
          <Button
            label="Share"
            size="lg"
            fullWidth
            onPress={() => {
              shareRun().catch(() => {});
            }}
            iconLeft={<Share2 color={theme.colors.onAccent} size={18} />}
            style={styles.shareButton}
          />
        </View>
      ) : null}

      {/* What today added to the map. Only after finishing — mid-run it would
          be a distraction from the run. */}
      {done && explored ? (
        <Card
          variant="light"
          padding="base"
          radius="xl"
          style={styles.explored}
        >
          <View style={styles.exploredRow}>
            <Compass color={theme.colors.accent} size={20} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">
                {explored.discovered > 0
                  ? `${explored.discovered} new blocks`
                  : 'Familiar ground'}
              </Text>
              <Text variant="bodySm" tone="muted" style={styles.exploredText}>
                {explored.text}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {done && clubPost ? (
        <Card
          variant="light"
          padding="base"
          radius="xl"
          style={styles.explored}
        >
          <Text variant="bodyStrong">
            {clubPost.state === 'posted'
              ? `Posted to ${clubPost.names.slice(0, 2).join(' and ')}${
                  clubPost.names.length > 2
                    ? ` +${clubPost.names.length - 2}`
                    : ''
                }`
              : clubPost.state === 'refused'
              ? 'Not posted to your clubs'
              : 'Your clubs did not get this one'}
          </Text>
          <Text variant="bodySm" tone="muted" style={styles.exploredText}>
            {clubPost.state === 'posted'
              ? 'It counts on this week\u2019s board.'
              : clubPost.state === 'refused'
              ? clubPost.reason
              : 'It is saved here. Check your connection — the board only sees what reaches it.'}
          </Text>
        </Card>
      ) : null}

      {done ? (
        <RouteMap
          segments={summary.segments}
          height={210}
          showMarkers
          style={styles.map}
        />
      ) : null}

      {status === 'denied' ? (
        <Card variant="light" padding="base" radius="xl" style={styles.notice}>
          <Text variant="bodyStrong">Location is off</Text>
          <Text variant="bodySm" tone="muted" style={styles.noticeBody}>
            Flint needs location to measure distance. Turn it on in Settings and
            come back — nothing is recorded until you press start.
          </Text>
        </Card>
      ) : null}

      {status === 'failed' ? (
        <Card variant="light" padding="base" radius="xl" style={styles.notice}>
          <Text variant="bodyStrong">GPS did not start</Text>
          <Text variant="bodySm" tone="muted" style={styles.noticeBody}>
            Android stopped Flint from starting the recorder. Keep the app open
            on this screen and try again.
          </Text>
        </Card>
      ) : null}

      {/*
        Asked before the run, never during it. On several popular Android
        brands a locked screen kills GPS unless the app is exempted, and the
        runner finds out at kilometre six otherwise.
      */}
      {batteryRestricted && (status === 'idle' || status === 'denied') ? (
        <Card variant="light" padding="base" radius="xl" style={styles.notice}>
          <View style={styles.exploredRow}>
            <BatteryCharging color={theme.colors.accent} size={20} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">
                Keep recording with the screen off
              </Text>
              <Text variant="bodySm" tone="muted" style={styles.noticeBody}>
                Some phones cut GPS to save battery once the screen locks. Set
                Flint to "Don't optimise" so your whole run counts.
              </Text>
            </View>
          </View>
          <Button
            label="Open battery settings"
            size="sm"
            variant="outline"
            onPress={allowBackground}
            style={styles.noticeAction}
          />
        </Card>
      ) : null}

      {saveError ? (
        <Card variant="light" padding="base" radius="xl" style={styles.notice}>
          <Text variant="bodyStrong">Not synced yet</Text>
          <Text variant="bodySm" tone="muted" style={styles.noticeBody}>
            {saveError}
          </Text>
        </Card>
      ) : null}

      {summary.splits.length > 0 ? (
        <View>
          <SectionHeader
            title="Splits"
            subtitle="Per kilometre"
            style={styles.section}
          />
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
        {status === 'idle' || status === 'denied' || status === 'failed' ? (
          <Button
            label={
              status === 'idle'
                ? `Start ${KIND_LABEL[kind].toLowerCase()}`
                : 'Try again'
            }
            size="lg"
            fullWidth
            onPress={begin}
            iconLeft={<Play color={theme.colors.onAccent} size={18} />}
          />
        ) : null}

        {status === 'acquiring' ? (
          <>
            <Button
              label={
                accuracy === null
                  ? 'Finding GPS…'
                  : `Finding GPS… ±${Math.round(accuracy)} m`
              }
              size="lg"
              fullWidth
              disabled
            />
            <Text variant="caption" tone="muted" align="center">
              Step outside or away from tall buildings. Starts on its own once
              GPS is sharp.
            </Text>
          </>
        ) : null}

        {status === 'weakGps' ? (
          <>
            <Text variant="bodySm" tone="muted" align="center">
              GPS is weak here
              {accuracy !== null ? ` (±${Math.round(accuracy)} m)` : ''}. Your
              first few hundred metres may be off.
            </Text>
            <Button
              label="Start anyway"
              size="lg"
              fullWidth
              onPress={() => setStatus('countdown')}
            />
            <Button
              label="Keep waiting"
              size="md"
              variant="ghost"
              fullWidth
              onPress={begin}
            />
          </>
        ) : null}

        {status === 'starting' ? (
          <Button label="Starting…" size="lg" fullWidth disabled />
        ) : null}

        {done ? (
          <Button
            label="Done"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate('Tabs', { screen: 'City' })}
            iconLeft={<Check color={theme.colors.onAccent} size={18} />}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  call: { marginTop: 12, marginBottom: 16 },
  callText: { marginTop: 4 },
  content: { paddingBottom: 140 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  eyebrow: { marginTop: 22 },
  flex: { flex: 1 },
  explored: { marginTop: 16 },
  exploredRow: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  exploredText: { marginTop: 2 },
  map: { marginTop: 16 },
  share: { marginTop: 16, alignItems: 'center' },
  shareButton: { marginTop: 14 },
  notice: { marginTop: 16 },
  noticeBody: { marginTop: 4 },
  noticeAction: { marginTop: 12, alignSelf: 'flex-start' },
  section: { marginTop: 28 },
  splits: { rowGap: 10 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitKm: { minWidth: 70 },
  controls: { marginTop: 28, rowGap: 10 },
});
