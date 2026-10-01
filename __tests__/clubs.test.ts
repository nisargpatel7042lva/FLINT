import {
  aboveOf,
  overtakenBy,
  passedBy,
  rankOf,
  weekStartKey,
  weeklyBoard,
  type ClubRun,
} from '../src/services/clubBoard';
import {
  MIN_PACE_SEC_PER_KM,
  checkPlausible,
  formatPaceSec,
  loadRuns,
  paceOf,
  resetRuns,
  runId,
  saveRun,
  type RunRecord,
} from '../src/services/runs';

const WEEK = '2026-09-28'; // a Monday

let n = 0;
const run = (uid: string, km: number, day = '2026-09-30', hour = 6): ClubRun => {
  n += 1;
  return {
    id: `${uid}_${n}`,
    uid,
    kind: 'run',
    distanceKm: km,
    durationSec: km * 360,
    day,
    createdAt: `${day}T${String(hour).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}:00.000Z`,
  };
};

describe('weekStartKey', () => {
  it('is the Monday of the week', () => {
    expect(weekStartKey('2026-09-28')).toBe('2026-09-28'); // Monday itself
    expect(weekStartKey('2026-10-01')).toBe('2026-09-28'); // Thursday
    expect(weekStartKey('2026-10-04')).toBe('2026-09-28'); // Sunday
  });

  /*
   * The weekend long run belongs to the week it finishes. A Sunday reset would
   * wipe the board on the one morning the whole club is out running.
   */
  it('keeps Sunday in the same week as the Saturday before it', () => {
    expect(weekStartKey('2026-10-03')).toBe(weekStartKey('2026-10-04'));
  });

  it('crosses month and year boundaries', () => {
    expect(weekStartKey('2026-01-01')).toBe('2025-12-29');
  });
});

describe('weeklyBoard', () => {
  it('ranks by distance this week', () => {
    const board = weeklyBoard([run('a', 5), run('b', 8), run('a', 4)], WEEK);
    expect(board.map(e => e.uid)).toEqual(['a', 'b']);
    expect(board[0].km).toBe(9);
    expect(board[0].runs).toBe(2);
  });

  it('ignores last week', () => {
    const board = weeklyBoard([run('a', 50, '2026-09-27'), run('b', 3)], WEEK);
    expect(board.map(e => e.uid)).toEqual(['b']);
  });

  /* Walkers are members too. A club that ignores them stays small. */
  it('counts walks', () => {
    const walk: ClubRun = { ...run('w', 6), kind: 'walk' };
    expect(rankOf(weeklyBoard([walk], WEEK), 'w')).toBe(1);
  });

  /* A tie goes to whoever got there first — overtaking means doing more. */
  it('breaks a tie in favour of whoever reached it first', () => {
    const early = run('early', 5, '2026-09-29', 6);
    const late = run('late', 5, '2026-09-30', 7);
    expect(weeklyBoard([late, early], WEEK).map(e => e.uid)).toEqual(['early', 'late']);
  });
});

describe('passedBy', () => {
  it('names whoever moved above you since you last looked', () => {
    const board = weeklyBoard([run('me', 5), run('vikram', 7), run('ana', 9)], WEEK);
    expect(passedBy(board, 'me', ['ana']).map(e => e.uid)).toEqual(['vikram']);
  });

  it('is empty when nothing changed', () => {
    const board = weeklyBoard([run('me', 5), run('ana', 9)], WEEK);
    expect(passedBy(board, 'me', ['ana'])).toEqual([]);
  });

  /*
   * The guardrail. Somebody who has not run yet this week is not "passed" —
   * they are just not started, and telling them five people overtook them is
   * how you make sure they never do.
   */
  it('stays quiet for somebody who has not run this week', () => {
    const board = weeklyBoard([run('vikram', 7), run('ana', 9)], WEEK);
    expect(passedBy(board, 'me', [])).toEqual([]);
  });

  it('lists the most recent passer first', () => {
    const board = weeklyBoard(
      [run('me', 3), run('first', 6, '2026-09-29'), run('second', 5, '2026-10-01')],
      WEEK,
    );
    expect(passedBy(board, 'me', []).map(e => e.uid)).toEqual(['second', 'first']);
  });
});

describe('overtakenBy', () => {
  it('finds who a new run overtook', () => {
    const before = [run('ana', 9), run('vikram', 7), run('me', 5)];
    const newRun = run('me', 3); // me: 8km, past vikram, not ana
    expect(overtakenBy(before, newRun, WEEK)).toEqual(['vikram']);
  });

  it('counts a first run of the week overtaking everyone it beats', () => {
    const before = [run('ana', 4), run('vikram', 7)];
    expect(overtakenBy(before, run('me', 5), WEEK)).toEqual(['ana']);
  });

  it('notifies nobody when the run changes no places', () => {
    const before = [run('ana', 20), run('me', 1)];
    expect(overtakenBy(before, run('me', 1), WEEK)).toEqual([]);
  });

  it('never notifies the runner about themselves', () => {
    expect(overtakenBy([], run('me', 5), WEEK)).toEqual([]);
  });

  it('agrees with aboveOf after the run', () => {
    const before = [run('ana', 9), run('vikram', 7), run('me', 5)];
    const newRun = run('me', 3);
    const after = weeklyBoard([...before, newRun], WEEK);
    overtakenBy(before, newRun, WEEK).forEach(u =>
      expect(aboveOf(after, 'me')).not.toContain(u),
    );
  });
});

describe('checkPlausible', () => {
  it('accepts an ordinary run, a slow walk and an elite 10k', () => {
    expect(checkPlausible({ distanceKm: 5, durationSec: 1800 }).ok).toBe(true);
    expect(checkPlausible({ distanceKm: 3, durationSec: 3600 }).ok).toBe(true);
    expect(checkPlausible({ distanceKm: 10, durationSec: 1800 }).ok).toBe(true);
  });

  /* The car check. 10km in 15 minutes is 40km/h. */
  it('refuses a pace nobody can run', () => {
    expect(checkPlausible({ distanceKm: 10, durationSec: 900 }).ok).toBe(false);
  });

  it('matches the floor the server enforces', () => {
    expect(
      checkPlausible({ distanceKm: 1, durationSec: MIN_PACE_SEC_PER_KM }).ok,
    ).toBe(true);
    expect(
      checkPlausible({ distanceKm: 1, durationSec: MIN_PACE_SEC_PER_KM - 1 }).ok,
    ).toBe(false);
  });

  /* A GPS jump on a short outing is noise, not a drive. */
  it('does not judge pace on a very short distance', () => {
    expect(checkPlausible({ distanceKm: 0.3, durationSec: 20 }).ok).toBe(true);
  });

  it('refuses impossible distances and durations', () => {
    expect(checkPlausible({ distanceKm: 250, durationSec: 80000 }).ok).toBe(false);
    expect(checkPlausible({ distanceKm: 5, durationSec: 0 }).ok).toBe(false);
    expect(checkPlausible({ distanceKm: NaN, durationSec: 100 }).ok).toBe(false);
  });
});

describe('pace', () => {
  it('formats the way runners say it', () => {
    expect(formatPaceSec(paceOf({ distanceKm: 5, durationSec: 1710 }))).toBe('5:42');
    expect(formatPaceSec(360)).toBe('6:00');
  });

  it('has no pace without distance', () => {
    expect(paceOf({ distanceKm: 0, durationSec: 600 })).toBeNull();
    expect(formatPaceSec(null)).toBe('—');
  });
});

describe('run history', () => {
  beforeEach(() => resetRuns());

  const record = (ms: number, km: number): RunRecord => ({
    id: runId('me', ms),
    kind: 'run',
    distanceKm: km,
    durationSec: km * 360,
    day: '2026-09-30',
    startedAt: new Date(ms).toISOString(),
  });

  it('round-trips, newest first', async () => {
    await saveRun(record(1_000, 3));
    await saveRun(record(2_000, 5));
    expect((await loadRuns()).map(r => r.distanceKm)).toEqual([5, 3]);
  });

  it('does not store the same run twice', async () => {
    await saveRun(record(1_000, 3));
    await saveRun(record(1_000, 3));
    expect(await loadRuns()).toHaveLength(1);
  });

  it('derives the id from the runner and start time', () => {
    expect(runId('abc', 1_790_000_000_123.7)).toBe('abc_1790000000123');
  });
});
