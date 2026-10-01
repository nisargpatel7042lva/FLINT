import type { RunKind } from './runs';

/**
 * A club's week: who ran, how far, and who just overtook whom.
 *
 * Pure functions over posted runs, so the same maths drives the in-app board,
 * the "passed you" banner, and the Cloud Function that sends the push — and so
 * it can be tested without a database.
 */

/** A run as it appears in a club feed — what other members can see. */
export type ClubRun = {
  id: string;
  uid: string;
  kind: RunKind;
  distanceKm: number;
  durationSec: number;
  day: string;
  /** ISO. Ordering within a day. */
  createdAt: string;
};

export type BoardEntry = {
  uid: string;
  km: number;
  runs: number;
  /** ISO of their most recent run this week. */
  lastRunAt: string;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/**
 * The Monday that starts the week containing `day`, as a local day key.
 *
 * Monday rather than Sunday because run clubs plan their week around the
 * weekend long run, and a board that reset on Sunday morning would wipe it
 * before anyone had seen it.
 */
export function weekStartKey(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return dayKey(d);
}

/**
 * The weekly distance board.
 *
 * Distance, not pace or run count. Pace rewards the already-fast and leaves a
 * new runner permanently at the bottom; run count rewards logging a lap of the
 * car park. Distance is the one number every member can move by showing up
 * once more.
 *
 * Walks count. A run club that turns away the people walking their way into
 * running is a club that stays small.
 */
export function weeklyBoard(runs: ClubRun[], weekStart: string): BoardEntry[] {
  const byUid = new Map<string, BoardEntry>();

  runs
    .filter(r => r.day >= weekStart)
    .forEach(r => {
      const entry = byUid.get(r.uid) ?? { uid: r.uid, km: 0, runs: 0, lastRunAt: '' };
      entry.km += r.distanceKm;
      entry.runs += 1;
      if (r.createdAt > entry.lastRunAt) {
        entry.lastRunAt = r.createdAt;
      }
      byUid.set(r.uid, entry);
    });

  return [...byUid.values()]
    .map(e => ({ ...e, km: Math.round(e.km * 100) / 100 }))
    .sort(
      (a, b) =>
        b.km - a.km ||
        // Equal distance: whoever got there first holds the place. Being
        // overtaken has to mean somebody actually did more.
        a.lastRunAt.localeCompare(b.lastRunAt) ||
        a.uid.localeCompare(b.uid),
    );
}

/** 1-based rank, or null when the person has not run this week. */
export function rankOf(board: BoardEntry[], uid: string): number | null {
  const i = board.findIndex(e => e.uid === uid);
  return i === -1 ? null : i + 1;
}

/** Everyone currently ranked above `uid`. */
export function aboveOf(board: BoardEntry[], uid: string): string[] {
  const i = board.findIndex(e => e.uid === uid);
  return i === -1 ? [] : board.slice(0, i).map(e => e.uid);
}

/**
 * Who has overtaken `uid` since `previousAbove` was recorded.
 *
 * Newest first, by their latest run, because the banner names one person and
 * it should be the one who did it most recently.
 *
 * Returns nothing when the person has not run this week: being "passed" while
 * standing still at zero is not news, it is just the board, and telling
 * somebody who has not started yet that five people passed them is how you
 * make sure they never do.
 */
export function passedBy(
  board: BoardEntry[],
  uid: string,
  previousAbove: string[],
): BoardEntry[] {
  if (rankOf(board, uid) === null) {
    return [];
  }
  const before = new Set(previousAbove);
  const nowAbove = new Set(aboveOf(board, uid));
  return board
    .filter(e => nowAbove.has(e.uid) && !before.has(e.uid))
    .sort((a, b) => b.lastRunAt.localeCompare(a.lastRunAt));
}

/**
 * Who a new run just overtook — the server side of "passed you".
 *
 * Compares the board without this run to the board with it, and returns the
 * members who were at or ahead of the runner before and are behind them now.
 * Those are the people who get the push.
 */
export function overtakenBy(
  runsBefore: ClubRun[],
  newRun: ClubRun,
  weekStart: string,
): string[] {
  const before = weeklyBoard(runsBefore, weekStart);
  const after = weeklyBoard([...runsBefore, newRun], weekStart);

  const aheadBefore = new Set(
    rankOf(before, newRun.uid) === null
      ? before.map(e => e.uid)
      : aboveOf(before, newRun.uid),
  );
  const aheadAfter = new Set(aboveOf(after, newRun.uid));

  return [...aheadBefore].filter(u => u !== newRun.uid && !aheadAfter.has(u));
}
