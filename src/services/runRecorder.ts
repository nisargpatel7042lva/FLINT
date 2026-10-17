import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

import {
  createAccumulator,
  requestLocationPermission,
  startTracking,
  summarise,
  type Accumulator,
  type LocationTracker,
  type TrackSummary,
} from './location';
import type { RunKind } from './runs';

/**
 * Records a run, screen on or off.
 *
 * On Android a native foreground service does the recording (see
 * `android/.../run/RunTrackingService.kt`) and this module pulls its points.
 * The plain JS watcher in `location.ts` is the fallback where that service does
 * not exist — iOS for now, and tests — and it stops when the app is
 * backgrounded, which is exactly the problem the service solves.
 *
 * The run's state lives natively, not here. That is what lets the screen be
 * closed, the app swiped away, or the process killed mid-run, and still come
 * back to the same run with every point.
 */

export type RecorderStatus = {
  active: boolean;
  paused: boolean;
  /** Epoch ms. */
  startedAt: number;
  /** Paused time already banked. */
  pausedMs: number;
  /** Epoch ms the current pause began, or 0. */
  pausedSince: number;
  kind: RunKind;
  count: number;
};

/** `[lat, lon, timeMs, accuracy, segment]`, as the service sends them. */
export type RawPoint = [number, number, number, number, number];

export type NativeRecorder = {
  start: (kind: RunKind) => Promise<RecorderStatus>;
  ensureRecording: () => Promise<RecorderStatus>;
  pause: () => Promise<RecorderStatus>;
  resume: () => Promise<RecorderStatus>;
  getStatus: () => Promise<RecorderStatus>;
  pointsSince: (from: number) => Promise<RawPoint[]>;
  finish: () => Promise<boolean>;
  isBatteryUnrestricted: () => Promise<boolean>;
  openBatterySettings: () => Promise<boolean>;
};

const native: NativeRecorder | undefined =
  Platform.OS === 'android' ? NativeModules.FlintRunTracker : undefined;

export const hasBackgroundRecorder = (): boolean => Boolean(native);

export const IDLE_STATUS: RecorderStatus = {
  active: false,
  paused: false,
  startedAt: 0,
  pausedMs: 0,
  pausedSince: 0,
  kind: 'run',
  count: 0,
};

/**
 * Moving time, from the recorder's own timestamps.
 *
 * Derived rather than ticked: a JS interval stops while the phone is in a
 * pocket, so a counter would come back short by however long the screen was
 * off. Timestamps cannot drift.
 */
export function movingSeconds(s: RecorderStatus, now: number): number {
  if (!s.active || s.startedAt <= 0) {
    return 0;
  }
  const pausedNow = s.pausedSince > 0 ? now - s.pausedSince : 0;
  return Math.max(0, Math.floor((now - s.startedAt - s.pausedMs - pausedNow) / 1000));
}

/**
 * Feeds raw points into the accumulator, breaking segments where the service
 * did. Returns the segment of the last point seen, to pass back next time.
 *
 * The service numbers segments; a change of number is a resume after a pause,
 * and the gap must never be drawn — or counted — as a straight line.
 */
export function feedPoints(
  acc: Accumulator,
  points: RawPoint[],
  lastSegment: number | null,
): number | null {
  let seg = lastSegment;
  points.forEach(([latitude, longitude, timestamp, accuracy, segment]) => {
    if (seg !== null && segment !== seg) {
      acc.breakSegment();
    }
    seg = segment;
    acc.add({ latitude, longitude, timestamp, accuracy });
  });
  return seg;
}

/** Android 13+ hides a foreground service's notification without this. */
async function askForNotifications() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return;
  }
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Recording works without it; only the ongoing notification goes missing.
  }
}

export type LiveRun = {
  status: () => RecorderStatus;
  summary: () => TrackSummary;
  /** Pulls anything recorded since the last call. Safe to call often. */
  sync: () => Promise<TrackSummary>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the run and returns its final shape. */
  finish: () => Promise<TrackSummary>;
};

/**
 * Connects to the run in progress, if there is one.
 *
 * Used both to start fresh and to reattach after the app was closed: either
 * way every point is pulled from zero, so the screen never shows a partial
 * route.
 */
export async function attach(n: NativeRecorder, initial: RecorderStatus): Promise<LiveRun> {
  const acc = createAccumulator();
  let pulled = 0;
  let lastSegment: number | null = null;
  let status = initial;
  let summary = summarise(acc.segments);

  const pull = async () => {
    const [fresh, s] = await Promise.all([n.pointsSince(pulled), n.getStatus()]);
    if (fresh.length > 0) {
      pulled += fresh.length;
      lastSegment = feedPoints(acc, fresh, lastSegment);
      summary = summarise(acc.segments);
    }
    status = s;
    return summary;
  };

  /*
   * One pull at a time. The clock tick, the return from the lock screen and
   * finishing can all ask at once, and two pulls from the same offset feed the
   * same points twice — the route doubles back on itself and the distance
   * comes out twice as long.
   */
  let inflight: Promise<TrackSummary> | null = null;
  const sync = (): Promise<TrackSummary> => {
    if (!inflight) {
      inflight = pull().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };

  await sync();

  return {
    status: () => status,
    summary: () => summary,
    sync,
    pause: async () => {
      status = await n.pause();
    },
    resume: async () => {
      status = await n.resume();
    },
    finish: async () => {
      // Twice: the first may be a pull that started before Finish was pressed.
      await sync();
      await sync();
      await n.finish();
      status = IDLE_STATUS;
      return summarise(acc.segments.filter(s => s.length > 0));
    },
  };
}

/** The run left running, if any — recording restarted if the app had died. */
export async function resumeActiveRun(): Promise<LiveRun | null> {
  if (!native) {
    return null;
  }
  const s = await native.getStatus();
  if (!s.active) {
    return null;
  }
  return attach(native, await native.ensureRecording());
}

export async function getRecorderStatus(): Promise<RecorderStatus> {
  return native ? native.getStatus() : IDLE_STATUS;
}

/** Throws away a run without saving it. */
export async function discardActiveRun(): Promise<void> {
  await native?.finish();
}

export type StartResult =
  | { ok: true; run: LiveRun }
  | { ok: false; reason: 'denied' | 'failed' };

/**
 * Starts a run. Returns `denied` if location was refused.
 *
 * Where there is no background recorder, the foreground watcher is wrapped in
 * the same shape so the screen has one code path.
 */
export async function startRun(kind: RunKind): Promise<StartResult> {
  if (!native) {
    return startForegroundRun();
  }
  if (!(await requestLocationPermission())) {
    return { ok: false, reason: 'denied' };
  }
  await askForNotifications();
  try {
    return { ok: true, run: await attach(native, await native.start(kind)) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

async function startForegroundRun(): Promise<StartResult> {
  let latest = summarise([]);
  const tracker: LocationTracker | null = await startTracking(s => {
    latest = s;
  });
  if (!tracker) {
    return { ok: false, reason: 'denied' };
  }
  let status: RecorderStatus = {
    ...IDLE_STATUS,
    active: true,
    startedAt: Date.now(),
  };
  return {
    ok: true,
    run: {
      status: () => status,
      summary: () => latest,
      sync: async () => latest,
      pause: async () => {
        tracker.pause();
        status = { ...status, paused: true, pausedSince: Date.now() };
      },
      resume: async () => {
        tracker.resume();
        status = {
          ...status,
          paused: false,
          pausedMs: status.pausedMs + (Date.now() - status.pausedSince),
          pausedSince: 0,
        };
      },
      finish: async () => {
        status = IDLE_STATUS;
        return tracker.stop();
      },
    },
  };
}

// ── Battery ────────────────────────────────────────────────────────────────

/**
 * Whether Android may still kill the recorder to save battery.
 *
 * Stock Android leaves a foreground service alone. Several of the brands most
 * common in India do not, unless the app is exempted — so the run screen asks,
 * once, rather than letting someone find out at kilometre six.
 */
export async function isBatteryRestricted(): Promise<boolean> {
  if (!native) {
    return false;
  }
  try {
    return !(await native.isBatteryUnrestricted());
  } catch {
    return false;
  }
}

export async function openBatterySettings(): Promise<boolean> {
  return native ? native.openBatterySettings() : false;
}
