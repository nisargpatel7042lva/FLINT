import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Runs and walks, as runs.
 *
 * A training session is one-per-day and carries minutes, not metres — fine for
 * a streak, useless for a run club. A club needs to know who ran how far and
 * how fast this morning, and the "prove us wrong" predictions need the
 * person's own recent distances. So a GPS outing is also kept as a run record.
 *
 * Kept on the device, capped. It is the input to predictions and the source of
 * what gets posted to clubs; the club copy is what other people see.
 */

export type RunKind = 'run' | 'walk';

export type RunRecord = {
  /** `${uid}_${startedAtMs}` — the same id everywhere the run is posted. */
  id: string;
  kind: RunKind;
  distanceKm: number;
  durationSec: number;
  /** Local `YYYY-MM-DD`. */
  day: string;
  startedAt: string;
};

/**
 * The run's id, derived rather than random.
 *
 * Posting a run to three clubs writes three documents with the same id, and
 * the rules accept the id only if it starts with the poster's own uid — so a
 * run cannot be posted as somebody else, and the same run cannot be posted
 * twice to one club (the second write collides with the first).
 */
export const runId = (uid: string, startedAtMs: number): string =>
  `${uid}_${Math.floor(startedAtMs)}`;

// ── Plausibility ───────────────────────────────────────────────────────────
//
// These numbers are mirrored in firestore.rules. Once a club board exists,
// somebody WILL log a drive as a run to get to the top of it, and every honest
// runner on that board loses interest the day they notice. The checks are
// generous enough never to refuse a real run.

/** Longest single outing accepted. A 100km ultra is a real thing people do. */
export const MAX_RUN_KM = 100;
/** A full day. */
export const MAX_RUN_SECONDS = 24 * 60 * 60;
/**
 * Fastest pace accepted, in seconds per km.
 *
 * 2:30/km is 24 km/h — faster than the marathon world record (~2:52/km) held
 * for anything beyond a sprint. Below this it is a bike or a car.
 */
export const MIN_PACE_SEC_PER_KM = 150;
/** Below this distance pace is too noisy to judge: a GPS jump, not a drive. */
const PACE_CHECK_FROM_KM = 0.5;

export type Plausibility = { ok: true } | { ok: false; reason: string };

export function checkPlausible(run: Pick<RunRecord, 'distanceKm' | 'durationSec'>): Plausibility {
  const { distanceKm, durationSec } = run;
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > MAX_RUN_KM) {
    return { ok: false, reason: 'That distance is not possible on foot.' };
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > MAX_RUN_SECONDS) {
    return { ok: false, reason: 'That duration is not possible.' };
  }
  if (distanceKm >= PACE_CHECK_FROM_KM && durationSec / distanceKm < MIN_PACE_SEC_PER_KM) {
    return {
      ok: false,
      reason: 'Faster than anyone can run. Was this on a bike or in a car?',
    };
  }
  return { ok: true };
}

/** Seconds per km, or null when there is no distance to divide by. */
export const paceOf = (run: Pick<RunRecord, 'distanceKm' | 'durationSec'>): number | null =>
  run.distanceKm > 0 ? run.durationSec / run.distanceKm : null;

/** `5:42` — pace from seconds per km. (`location.formatPace` takes minutes.) */
export function formatPaceSec(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) {
    return '—';
  }
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ── Local history ──────────────────────────────────────────────────────────

const KEY = 'flint.runs.v1';
/** Enough for months of predictions; small enough to read on every start. */
const MAX_STORED = 200;

const isRun = (v: unknown): v is RunRecord => {
  const r = v as RunRecord;
  return (
    !!r &&
    typeof r.id === 'string' &&
    (r.kind === 'run' || r.kind === 'walk') &&
    typeof r.distanceKm === 'number' &&
    typeof r.durationSec === 'number' &&
    typeof r.day === 'string' &&
    typeof r.startedAt === 'string'
  );
};

/** Newest first. */
export async function loadRuns(): Promise<RunRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter(isRun) : [];
  } catch {
    return [];
  }
}

export async function saveRun(run: RunRecord): Promise<RunRecord[]> {
  const existing = await loadRuns();
  const next = [run, ...existing.filter(r => r.id !== run.id)]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, MAX_STORED);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A failed write loses this run from predictions, never the run itself:
    // the session log and any club posts are written separately.
  }
  return next;
}

export const resetRuns = () => AsyncStorage.removeItem(KEY).catch(() => {});
