import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/**
 * GPS tracking for outdoor sessions.
 *
 * Uses Fused Location on Android via @react-native-community/geolocation. Only
 * foreground location is requested — sessions are tracked while the app is
 * open, so background location would be asking for a permission we do not use.
 */

export type GeoPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
};

/**
 * A continuous stretch of movement.
 *
 * A pause closes one segment and opens another, which is what stops the app
 * from drawing a straight line across town when someone pauses at a café and
 * resumes three streets away — and from counting that line as distance.
 */
export type Segment = GeoPoint[];

/** Elapsed moving time for one completed kilometre. */
export type Split = { km: number; seconds: number };

export type TrackSummary = {
  segments: Segment[];
  /** Flattened points, for drawing the route. */
  points: GeoPoint[];
  distanceKm: number;
  /** Wall clock from the first fix to the last, paused time included. */
  durationSeconds: number;
  /** Excludes paused time. Pace is derived from this, not from the wall clock. */
  movingSeconds: number;
  /** Minutes per km, or null until there is enough distance to mean anything. */
  paceMinPerKm: number | null;
  splits: Split[];
};

export const EMPTY_SUMMARY: TrackSummary = {
  segments: [],
  points: [],
  distanceKm: 0,
  durationSeconds: 0,
  movingSeconds: 0,
  paceMinPerKm: null,
  splits: [],
};

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  // Fused Location on Android: better accuracy for the same battery.
  locationProvider: 'auto',
});

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return new Promise(resolve =>
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      ),
    );
  }

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  // Android 12+ can grant COARSE only. That is still usable for distance, so
  // treat either grant as success rather than forcing an all-or-nothing prompt.
  return (
    granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' ||
    granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted'
  );
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Discards jitter: GPS noise while standing still otherwise inflates distance. */
const MIN_ACCURACY_M = 50;
const MIN_STEP_KM = 0.005;

/**
 * Above this, a "step" is a teleport rather than a person.
 *
 * 25 m/s is 90 km/h — far beyond running or cycling, so this never polices
 * pace. It exists to catch the two ways GPS lies about position: the first fix
 * after a cold start is frequently the last *known* location from hours ago,
 * and a lost signal can fall back to a cell tower kilometres away. Either one
 * adds a phantom leg to the route and inflates the distance.
 */
const MAX_PLAUSIBLE_MPS = 25;

/** Consecutive rejects after which we believe the GPS and not our history. */
const MAX_CONSECUTIVE_SKIPS = 3;

const impliedSpeedMps = (a: GeoPoint, b: GeoPoint): number => {
  const seconds = (b.timestamp - a.timestamp) / 1000;
  if (seconds <= 0) {
    return Infinity;
  }
  return (haversineKm(a, b) * 1000) / seconds;
};

export type Accumulator = {
  segments: Segment[];
  /** Records a fix. Returns true if it was kept. */
  add: (p: GeoPoint) => boolean;
  /** Ends the current segment so a pause never becomes a straight line. */
  breakSegment: () => void;
};

/**
 * Collects fixes into segments, rejecting implausible ones.
 *
 * Kept separate from the watcher so the rejection rules can be tested without
 * a GPS radio — they are the part most likely to be wrong.
 */
export function createAccumulator(): Accumulator {
  const segments: Segment[] = [[]];
  let skips = 0;

  const current = () => segments[segments.length - 1];

  return {
    segments,
    add(p) {
      const seg = current();
      const last = seg[seg.length - 1];

      if (!last) {
        seg.push(p);
        return true;
      }

      if (impliedSpeedMps(last, p) <= MAX_PLAUSIBLE_MPS) {
        skips = 0;
        seg.push(p);
        return true;
      }

      /*
       * A teleport off the very first fix means that fix was the stale one,
       * not this one — so replace it rather than rejecting everything that
       * follows, which is what rejecting forward would do.
       */
      if (seg.length === 1) {
        seg[0] = p;
        return true;
      }

      skips += 1;
      if (skips >= MAX_CONSECUTIVE_SKIPS) {
        // Several in a row: we really did move. Start fresh rather than
        // bridging the gap with a line nobody ran.
        skips = 0;
        segments.push([p]);
        return true;
      }
      return false;
    },
    breakSegment() {
      skips = 0;
      if (current().length > 0) {
        segments.push([]);
      }
    },
  };
}

/** Below this, pace is noise rather than information. */
const MIN_KM_FOR_PACE = 0.05;

/**
 * Derives every figure the tracking UI shows from the recorded segments.
 *
 * Distance and moving time are accumulated step by step *within* segments
 * only, so a pause contributes neither. Splits attribute each step's time
 * proportionally when a step straddles a kilometre boundary — without that,
 * a single 80-metre step landing across 1.00km would dump its whole duration
 * into one split and visibly skew it.
 */
export function summarise(segments: Segment[]): TrackSummary {
  let distanceKm = 0;
  let movingSeconds = 0;
  const splits: Split[] = [];

  let splitKm = 0;
  let splitSeconds = 0;

  segments.forEach(points => {
    for (let i = 1; i < points.length; i += 1) {
      const stepKm = haversineKm(points[i - 1], points[i]);
      if (stepKm < MIN_STEP_KM) {
        continue;
      }
      const stepSeconds = (points[i].timestamp - points[i - 1].timestamp) / 1000;
      if (stepSeconds <= 0) {
        continue;
      }

      distanceKm += stepKm;
      movingSeconds += stepSeconds;

      // Walk this step across however many kilometre boundaries it crosses.
      let remainingKm = stepKm;
      let remainingSeconds = stepSeconds;
      while (splitKm + remainingKm >= 1) {
        const needKm = 1 - splitKm;
        const share = (needKm / remainingKm) * remainingSeconds;
        splits.push({
          km: splits.length + 1,
          seconds: Math.round(splitSeconds + share),
        });
        remainingKm -= needKm;
        remainingSeconds -= share;
        splitKm = 0;
        splitSeconds = 0;
      }
      splitKm += remainingKm;
      splitSeconds += remainingSeconds;
    }
  });

  const flat = segments.flat();
  const durationSeconds =
    flat.length > 1
      ? Math.round((flat[flat.length - 1].timestamp - flat[0].timestamp) / 1000)
      : 0;

  const rounded = Math.round(distanceKm * 100) / 100;

  return {
    segments,
    points: flat,
    distanceKm: rounded,
    durationSeconds,
    movingSeconds: Math.round(movingSeconds),
    paceMinPerKm:
      distanceKm >= MIN_KM_FOR_PACE ? movingSeconds / 60 / distanceKm : null,
    splits,
  };
}

export type LocationTracker = {
  pause: () => void;
  resume: () => void;
  stop: () => TrackSummary;
  isPaused: () => boolean;
};

/**
 * Starts a foreground track. Call `stop()` to end it and get the summary.
 * Returns null if permission was refused.
 */
export async function startTracking(
  onUpdate?: (summary: TrackSummary) => void,
): Promise<LocationTracker | null> {
  const ok = await requestLocationPermission();
  if (!ok) {
    return null;
  }

  const acc = createAccumulator();
  let paused = false;

  const watchId = Geolocation.watchPosition(
    pos => {
      if (paused) {
        return;
      }
      const accuracy = pos.coords.accuracy ?? null;
      if (accuracy !== null && accuracy > MIN_ACCURACY_M) {
        return; // too imprecise to be worth recording
      }
      const kept = acc.add({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        timestamp: pos.timestamp,
        accuracy,
      });
      if (kept) {
        onUpdate?.(summarise(acc.segments));
      }
    },
    () => {
      /* transient fixes fail often; keep watching */
    },
    { enableHighAccuracy: true, distanceFilter: 5, interval: 3000, fastestInterval: 1000 },
  );

  return {
    isPaused: () => paused,
    pause: () => {
      paused = true;
    },
    resume: () => {
      if (!paused) {
        return;
      }
      paused = false;
      // A fresh segment: the gap while paused must never become a line.
      acc.breakSegment();
    },
    stop: () => {
      Geolocation.clearWatch(watchId);
      return summarise(acc.segments.filter(s => s.length > 0));
    },
  };
}

// ── Formatting ─────────────────────────────────────────────────────────────

/** "8:42" or "1:04:17". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const mm = hours > 0 ? String(mins).padStart(2, '0') : String(mins);
  return hours > 0
    ? `${hours}:${mm}:${String(secs).padStart(2, '0')}`
    : `${mm}:${String(secs).padStart(2, '0')}`;
}

/** "5:30 /km", or an em dash before there is enough distance to be honest. */
export function formatPace(paceMinPerKm: number | null): string {
  if (paceMinPerKm === null || !Number.isFinite(paceMinPerKm)) {
    return '—';
  }
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  // 5.999 min/km must read as 6:00, never 5:60.
  const carry = secs === 60;
  return `${carry ? mins + 1 : mins}:${String(carry ? 0 : secs).padStart(2, '0')} /km`;
}
