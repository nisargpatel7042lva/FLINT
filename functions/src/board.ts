/**
 * The club board, server side.
 *
 * A copy of `src/services/clubBoard.ts`, because the functions package is
 * compiled on its own and cannot import from the app. A copy of ranking logic is
 * exactly the kind of thing that drifts — the app says you are third and the
 * push says you were passed for second — so `__tests__/boardParity.test.ts`
 * runs the same fixtures through both and fails if they ever disagree.
 *
 * Only what the push needs is here: who a new run overtook.
 */

export type ClubRun = {
  id: string;
  uid: string;
  distanceKm: number;
  day: string;
  createdAt: string;
};

type BoardEntry = { uid: string; km: number; lastRunAt: string };

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** Monday of the week containing `day`. */
export function weekStartKey(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

function weeklyBoard(runs: ClubRun[], weekStart: string): BoardEntry[] {
  const byUid = new Map<string, BoardEntry>();
  runs
    .filter(r => r.day >= weekStart)
    .forEach(r => {
      const e = byUid.get(r.uid) ?? { uid: r.uid, km: 0, lastRunAt: '' };
      e.km += r.distanceKm;
      if (r.createdAt > e.lastRunAt) {
        e.lastRunAt = r.createdAt;
      }
      byUid.set(r.uid, e);
    });
  return [...byUid.values()]
    .map(e => ({ ...e, km: Math.round(e.km * 100) / 100 }))
    .sort(
      (a, b) =>
        b.km - a.km || a.lastRunAt.localeCompare(b.lastRunAt) || a.uid.localeCompare(b.uid),
    );
}

const above = (board: BoardEntry[], uid: string) => {
  const i = board.findIndex(e => e.uid === uid);
  return i === -1 ? null : board.slice(0, i).map(e => e.uid);
};

/** Members who were at or ahead of the runner before this run, and behind after. */
export function overtakenBy(
  runsBefore: ClubRun[],
  newRun: ClubRun,
  weekStart: string,
): string[] {
  const before = weeklyBoard(runsBefore, weekStart);
  const after = weeklyBoard([...runsBefore, newRun], weekStart);
  const aheadBefore = new Set(above(before, newRun.uid) ?? before.map(e => e.uid));
  const aheadAfter = new Set(above(after, newRun.uid) ?? []);
  return [...aheadBefore].filter(u => u !== newRun.uid && !aheadAfter.has(u));
}
