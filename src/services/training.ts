/**
 * Personal training domain: time-adaptive plans, session logs, streaks, stats
 * and Char's evolution stages.
 *
 * This is the individual loop. Nothing here knows about groups, wars or other
 * people — that lives in `scoring.ts` and stays out of this phase.
 */

export type Focus = 'legs' | 'upper' | 'core' | 'full' | 'cardio';

export const FOCUS_LABEL: Record<Focus, string> = {
  legs: 'Legs Day',
  upper: 'Upper Body',
  core: 'Core',
  full: 'Full Body',
  cardio: 'Cardio',
};

export type ExercisePlan = {
  id: string;
  name: string;
  /** One short coaching line. */
  cue: string;
  sets: number;
  /** Target reps per set. `null` means hold for `holdSeconds`. */
  reps: number | null;
  holdSeconds?: number;
  restSeconds: number;
};

export type WorkoutPlan = {
  id: string;
  /** Human title that makes the time fit obvious: "12-minute Legs Day". */
  title: string;
  focus: Focus;
  minutes: number;
  exercises: ExercisePlan[];
};

// ── Time model ─────────────────────────────────────────────────────────────
// Used to fit a plan to a budget. These are the tuning knobs for how dense a
// session feels; raising WORK_SECONDS makes sessions harder at equal length.

/** Assumed working time for one set. */
const WORK_SECONDS = 40;
/** Assumed transition time between exercises. */
const SETUP_SECONDS = 20;

type PoolEntry = Omit<ExercisePlan, 'id' | 'sets' | 'restSeconds'> & {
  restSeconds?: number;
};

const POOLS: Record<Focus, PoolEntry[]> = {
  legs: [
    { name: 'Bodyweight squats', cue: 'Chest up, full depth', reps: 15 },
    { name: 'Reverse lunges', cue: 'Alternate legs', reps: 12 },
    { name: 'Glute bridges', cue: 'Squeeze at the top', reps: 15 },
    { name: 'Calf raises', cue: 'Slow on the way down', reps: 20 },
    { name: 'Wall sit', cue: 'Thighs parallel', reps: null, holdSeconds: 45 },
    { name: 'Split squats', cue: 'Front knee tracks the toe', reps: 10 },
  ],
  upper: [
    { name: 'Push-ups', cue: 'Knees down is fine', reps: 12 },
    { name: 'Pike push-ups', cue: 'Hips high, head between hands', reps: 8 },
    { name: 'Inverted rows', cue: 'Under a table works', reps: 10 },
    { name: 'Tricep dips', cue: 'Use a chair edge', reps: 12 },
    { name: 'Superman holds', cue: 'Lift chest and thighs', reps: null, holdSeconds: 30 },
    { name: 'Shoulder taps', cue: 'Hips still', reps: 16 },
  ],
  core: [
    { name: 'Plank', cue: 'Hips level', reps: null, holdSeconds: 45 },
    { name: 'Dead bug', cue: 'Slow, ribs down', reps: 12 },
    { name: 'Bicycle crunches', cue: 'Controlled, not fast', reps: 20 },
    { name: 'Side plank', cue: 'Stack the shoulders', reps: null, holdSeconds: 30 },
    { name: 'Hollow hold', cue: 'Lower back pressed down', reps: null, holdSeconds: 30 },
    { name: 'Leg raises', cue: 'No swinging', reps: 12 },
  ],
  full: [
    { name: 'Burpees', cue: 'Step back if needed', reps: 10 },
    { name: 'Bodyweight squats', cue: 'Chest up, full depth', reps: 15 },
    { name: 'Push-ups', cue: 'Knees down is fine', reps: 12 },
    { name: 'Mountain climbers', cue: 'Controlled, not frantic', reps: 20 },
    { name: 'Reverse lunges', cue: 'Alternate legs', reps: 12 },
    { name: 'Plank', cue: 'Hips level', reps: null, holdSeconds: 45 },
  ],
  cardio: [
    { name: 'Jumping jacks', cue: 'Steady pace', reps: 30 },
    { name: 'High knees', cue: 'Quick feet', reps: 30 },
    { name: 'Skaters', cue: 'Push off sideways', reps: 20 },
    { name: 'Fast feet', cue: 'Stay on the balls of your feet', reps: 30 },
    { name: 'Squat jumps', cue: 'Land soft', reps: 12 },
    { name: 'Shadow boxing', cue: 'Keep moving', reps: null, holdSeconds: 45 },
  ],
};

/** Rest shrinks as the budget shrinks — short sessions stay dense. */
const baseRestFor = (minutes: number) => (minutes <= 8 ? 15 : minutes <= 15 ? 25 : 35);

/**
 * Per-focus density.
 *
 * Without this every focus produced the same shape at a given budget — five
 * options all reading "4 moves · 12 sets", which looks like a bug rather than a
 * choice. Rest is what actually differs between training styles: cardio is
 * relentless, strength earns recovery.
 */
const DENSITY: Record<Focus, { restScale: number; preferredSets: number }> = {
  cardio: { restScale: 0.5, preferredSets: 3 },
  core: { restScale: 0.7, preferredSets: 3 },
  full: { restScale: 0.9, preferredSets: 3 },
  legs: { restScale: 1.15, preferredSets: 4 },
  upper: { restScale: 1.15, preferredSets: 4 },
};

const restFor = (minutes: number, focus: Focus) =>
  Math.round(baseRestFor(minutes) * DENSITY[focus].restScale);

/**
 * Builds a plan that actually fits `minutes`.
 *
 * The fit is the product's whole promise, so the maths is explicit: each set
 * costs WORK_SECONDS + rest, each exercise adds SETUP_SECONDS, and the exercise
 * count and set count are chosen so the estimate lands inside the budget rather
 * than merely near it.
 *
 * TODO: this does not yet consider goal, equipment, fitness level, injury
 * history, recovery, or what was trained yesterday. A real programmer needs all
 * of those; the signature (budget in, fitted plan out) is what should survive.
 */
export function buildPlan(minutes: number, focus: Focus): WorkoutPlan {
  const budget = minutes * 60;
  const rest = restFor(minutes, focus);
  const perSet = WORK_SECONDS + rest;

  // Start from this focus's preferred set count and drop until at least three
  // distinct exercises fit inside the budget.
  let sets = DENSITY[focus].preferredSets;
  let count = 0;

  while (sets >= 1) {
    const perExercise = sets * perSet + SETUP_SECONDS;
    count = Math.floor(budget / perExercise);
    if (count >= 3) {
      break;
    }
    sets -= 1;
  }

  count = Math.min(Math.max(count, 2), POOLS[focus].length);

  const exercises = POOLS[focus].slice(0, count).map((e, i) => ({
    ...e,
    id: `${focus}-${i + 1}`,
    sets,
    restSeconds: e.restSeconds ?? rest,
  }));

  return {
    id: `${focus}-${minutes}`,
    title: `${minutes}-minute ${FOCUS_LABEL[focus]}`,
    focus,
    minutes,
    exercises,
  };
}

/** Estimated duration of a plan in seconds — used to show the fit honestly. */
export function estimateSeconds(plan: WorkoutPlan): number {
  return plan.exercises.reduce(
    (total, e) =>
      total + SETUP_SECONDS + e.sets * (WORK_SECONDS + e.restSeconds),
    0,
  );
}

export const totalSets = (plan: WorkoutPlan): number =>
  plan.exercises.reduce((n, e) => n + e.sets, 0);

/**
 * Today's suggestion. Rotates focus by day-of-year so consecutive days do not
 * repeat the same muscles.
 *
 * TODO: replace the rotation with real recovery-aware selection.
 */
export function suggestFocus(day: string): Focus {
  const order: Focus[] = ['full', 'legs', 'upper', 'core', 'cardio'];
  const d = new Date(`${day}T00:00:00`);
  const dayIndex = Math.floor(d.getTime() / 86400000);
  return order[Math.abs(dayIndex) % order.length];
}

export const suggestPlan = (minutes: number, day: string): WorkoutPlan =>
  buildPlan(minutes, suggestFocus(day));

/** Every budget the library offers. */
export const TIME_OPTIONS = [5, 10, 15, 20, 30] as const;

// ── Logging ────────────────────────────────────────────────────────────────

export type LoggedSet = {
  exerciseId: string;
  setIndex: number;
  reps: number;
  done: boolean;
};

export type SessionLog = {
  id: string;
  /** YYYY-MM-DD */
  day: string;
  title: string;
  focus: Focus;
  minutes: number;
  completedSets: number;
  totalSets: number;
  kcal: number;
};

// ── Streaks and stats ──────────────────────────────────────────────────────

/**
 * Local-date key. Deliberately NOT `toISOString()` — that converts to UTC, so
 * local midnight in any timezone ahead of UTC lands on the previous day. That
 * silently breaks consecutive-day comparison (every streak reads as 1) and
 * shifts calendar marks by a day.
 */
const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const shift = (d: Date, delta: number) => {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
};

/**
 * Consecutive days ending today (or yesterday — today still counts as alive
 * until midnight, so a streak is not "broken" simply because you have not
 * trained yet this morning).
 */
export function currentStreak(logs: SessionLog[], today: string): number {
  const days = new Set(logs.map(l => l.day));
  const start = new Date(`${today}T00:00:00`);

  // If nothing today, the streak can still be alive from yesterday.
  let cursor = days.has(today) ? start : shift(start, -1);
  if (!days.has(dayKey(cursor))) {
    return 0;
  }

  let n = 0;
  while (days.has(dayKey(cursor))) {
    n += 1;
    cursor = shift(cursor, -1);
  }
  return n;
}

/** True when the streak is alive but nothing has been logged today yet. */
export function streakAtRisk(logs: SessionLog[], today: string): boolean {
  const days = new Set(logs.map(l => l.day));
  return !days.has(today) && currentStreak(logs, today) > 0;
}

export function longestStreak(logs: SessionLog[]): number {
  const days = [...new Set(logs.map(l => l.day))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;

  for (const d of days) {
    const cur = new Date(`${d}T00:00:00`);
    run = prev && dayKey(shift(prev, 1)) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export type Stats = {
  weekSessions: number;
  weekMinutes: number;
  weekGoal: number;
  totalSessions: number;
  totalMinutes: number;
  totalKcal: number;
};

/** Weekly targets used by the dashboard rings. */
export const WEEKLY_GOAL_SESSIONS = 4;
export const WEEKLY_GOAL_MINUTES = 90;

export function computeStats(logs: SessionLog[], today: string): Stats {
  const start = shift(new Date(`${today}T00:00:00`), -6);
  const inWeek = logs.filter(l => new Date(`${l.day}T00:00:00`) >= start);

  return {
    weekSessions: inWeek.length,
    weekMinutes: inWeek.reduce((n, l) => n + l.minutes, 0),
    weekGoal: WEEKLY_GOAL_SESSIONS,
    totalSessions: logs.length,
    totalMinutes: logs.reduce((n, l) => n + l.minutes, 0),
    totalKcal: logs.reduce((n, l) => n + l.kcal, 0),
  };
}

// ── Activity intensity ─────────────────────────────────────────────────────

/**
 * Heatmap intensity, 0–4.
 *
 * Thresholds are pinned to the app's own TIME_OPTIONS (5/10/15/20/30) rather
 * than to quantiles of the user's history. Quantiles would look prettier but
 * they move: a light week would silently re-colour every past day, and a level
 * that means something different each time you open it is not a scale. Fixed
 * bands mean "dark orange" always means the same amount of work, and the legend
 * can state it plainly.
 */
export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export function intensityLevel(minutes: number): IntensityLevel {
  if (minutes <= 0) {
    return 0;
  }
  if (minutes < 10) {
    return 1; // a 5-minute session still counts
  }
  if (minutes < 15) {
    return 2;
  }
  if (minutes < 25) {
    return 3;
  }
  return 4;
}

/** Human-readable band, used by the legend and the day detail. */
export const INTENSITY_LABEL: Record<IntensityLevel, string> = {
  0: 'Rest day',
  1: 'Under 10 min',
  2: '10–14 min',
  3: '15–24 min',
  4: '25 min or more',
};

// ── Char evolution ─────────────────────────────────────────────────────────

export type CharStageId = 'ember' | 'flame' | 'blaze' | 'wildfire' | 'forge';

export type CharStage = {
  id: CharStageId;
  name: string;
  minStreak: number;
  blurb: string;
};

/**
 * Stages are driven by the CURRENT streak, not lifetime totals — Char measures
 * consistency, so it must be able to fall back down.
 */
export const CHAR_STAGES: CharStage[] = [
  { id: 'ember', name: 'Ember', minStreak: 0, blurb: 'Barely lit. One session changes that.' },
  { id: 'flame', name: 'Flame', minStreak: 3, blurb: 'Caught. Three days back to back.' },
  { id: 'blaze', name: 'Blaze', minStreak: 7, blurb: 'A full week. This is a habit now.' },
  { id: 'wildfire', name: 'Wildfire', minStreak: 21, blurb: 'Three weeks. Hard to put out.' },
  { id: 'forge', name: 'Forge', minStreak: 60, blurb: 'Two months. Char burns on its own.' },
];

export function charStage(streak: number): {
  stage: CharStage;
  next: CharStage | null;
  progress: number;
  daysToNext: number;
} {
  let index = 0;
  for (let i = 0; i < CHAR_STAGES.length; i += 1) {
    if (streak >= CHAR_STAGES[i].minStreak) {
      index = i;
    }
  }

  const stage = CHAR_STAGES[index];
  const next = CHAR_STAGES[index + 1] ?? null;

  if (!next) {
    return { stage, next: null, progress: 1, daysToNext: 0 };
  }

  const span = next.minStreak - stage.minStreak;
  return {
    stage,
    next,
    progress: Math.min(Math.max((streak - stage.minStreak) / span, 0), 1),
    daysToNext: Math.max(next.minStreak - streak, 0),
  };
}
