import { buildPlan, type ExercisePlan, type Focus, type WorkoutPlan } from './training';

/**
 * The exercise library.
 *
 * Data is vendored from free-exercise-db (public domain, Unlicense) by
 * `scripts/build-exercise-data.mjs`. It ships inside the app on purpose: 873
 * exercises with no API key, no rate limit, no network, and nothing that can
 * break because somebody else's free tier changed. See ATTRIBUTION.md.
 *
 * This module owns two jobs that are easy to conflate:
 *   1. Browsing  — "show me back exercises I can do with a barbell".
 *   2. Generating — "give me a 15-minute back session that actually fits".
 * The second is where the judgement lives, because the dataset has no sets,
 * reps or rest; those are derived here and the reasoning is written down.
 */

// ── Source data ────────────────────────────────────────────────────────────

/** The muscles the dataset actually tags. Not our invention — its vocabulary. */
export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps';

export type Level = 'beginner' | 'intermediate' | 'expert';
export type Mechanic = 'compound' | 'isolation';
export type Force = 'push' | 'pull' | 'static';

export type Equipment =
  | 'body only'
  | 'bands'
  | 'barbell'
  | 'cable'
  | 'dumbbell'
  | 'e-z curl bar'
  | 'exercise ball'
  | 'foam roll'
  | 'kettlebells'
  | 'machine'
  | 'medicine ball'
  | 'other';

export type Category =
  | 'cardio'
  | 'olympic weightlifting'
  | 'plyometrics'
  | 'powerlifting'
  | 'strength'
  | 'stretching'
  | 'strongman';

export type Exercise = {
  /** Also the image directory name, e.g. `Barbell_Squat`. */
  id: string;
  name: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment?: Equipment;
  level: Level;
  mechanic?: Mechanic;
  force?: Force;
  category: Category;
  imageCount: number;
};

/*
 * `require` rather than a static import, deliberately.
 *
 * With `resolveJsonModule` TypeScript infers a literal type for the entire
 * file — 873 object literals — which added ~17 seconds to every typecheck for
 * a type we immediately widen anyway. `require` hands back `any`, the cast
 * below is the type, and Metro bundles it identically.
 */
export const EXERCISES = require('../assets/exercises/catalog.json') as Exercise[];

const BY_ID = new Map(EXERCISES.map(e => [e.id, e]));

export const exerciseById = (id: string): Exercise | undefined => BY_ID.get(id);

/**
 * Illustration URL for an exercise.
 *
 * Every image is `{id}/{n}.jpg` upstream, so storing the paths again would be
 * 60KB of redundancy. Served from jsDelivr rather than raw.githubusercontent
 * because jsDelivr is an actual CDN with caching; raw GitHub is a source host
 * that happens to return images.
 *
 * Most exercises have two frames: 0 is the start position, 1 the end.
 */
const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';

export const exerciseImage = (id: string, frame = 0): string =>
  `${CDN}/${encodeURIComponent(id)}/${frame}.jpg`;

// ── Grouping for the UI ────────────────────────────────────────────────────

export type BodyRegion = 'chest' | 'back' | 'arms' | 'shoulders' | 'core' | 'legs';

/**
 * Seventeen muscles is the right vocabulary for filtering and the wrong one for
 * a home screen. These six regions are how people actually describe what they
 * want to train, and each one expands to the muscles the dataset tags.
 */
export const REGION_MUSCLES: Record<BodyRegion, Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  arms: ['biceps', 'triceps', 'forearms'],
  shoulders: ['shoulders', 'neck'],
  core: ['abdominals'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
};

export const REGION_LABEL: Record<BodyRegion, string> = {
  chest: 'Chest',
  back: 'Back',
  arms: 'Arms',
  shoulders: 'Shoulders',
  core: 'Core',
  legs: 'Legs',
};

export const BODY_REGIONS = Object.keys(REGION_LABEL) as BodyRegion[];

/** Title case for a dataset value, which arrives lowercased. */
export const titleCase = (s: string): string =>
  s.replace(/\b[a-z]/g, c => c.toUpperCase());

export const MUSCLE_LABEL = (m: Muscle): string => titleCase(m);

// ── Queries ────────────────────────────────────────────────────────────────

export type ExerciseFilter = {
  region?: BodyRegion;
  muscle?: Muscle;
  equipment?: Equipment[];
  level?: Level;
  category?: Category[];
  /** Matches name, case-insensitively. */
  search?: string;
};

/**
 * `primaryMuscles` only, deliberately.
 *
 * Matching secondary muscles too makes "biceps" return most of the back
 * catalogue, because almost every pull works the biceps a little. Someone who
 * picked biceps wants exercises *for* biceps.
 */
const hitsMuscles = (e: Exercise, muscles: Muscle[]) =>
  e.primaryMuscles.some(m => muscles.includes(m));

/**
 * Untagged equipment means bodyweight, not "other".
 *
 * 77 exercises carry no equipment field. Reading that as `other` was wrong in
 * both directions: it hid genuinely equipment-free work (Bodyweight Walking
 * Lunge, Inverted Row, Decline Push-Up) from the home filter, while `other`
 * itself is where the dataset puts sleds, balance boards and — literally —
 * Car Deadlift.
 */
export const equipmentOf = (e: Exercise): Equipment => e.equipment ?? 'body only';

export function findExercises(filter: ExerciseFilter = {}): Exercise[] {
  const { region, muscle, equipment, level, category, search } = filter;
  const muscles = muscle ? [muscle] : region ? REGION_MUSCLES[region] : null;
  const term = search?.trim().toLowerCase();

  return EXERCISES.filter(e => {
    if (muscles && !hitsMuscles(e, muscles)) {
      return false;
    }
    if (equipment?.length && !equipment.includes(equipmentOf(e))) {
      return false;
    }
    if (level && e.level !== level) {
      return false;
    }
    if (category?.length && !category.includes(e.category)) {
      return false;
    }
    if (term && !e.name.toLowerCase().includes(term)) {
      return false;
    }
    return true;
  });
}

/** How many exercises each region offers — shown on the picker tiles. */
export const regionCounts = (): Record<BodyRegion, number> =>
  BODY_REGIONS.reduce(
    (acc, r) => ({ ...acc, [r]: findExercises({ region: r }).length }),
    {} as Record<BodyRegion, number>,
  );

/** Instructions are loaded on demand — see the note in the build script. */
export function exerciseInstructions(id: string): string[] {
  const all = require('../assets/exercises/instructions.json') as Record<
    string,
    string[]
  >;
  return all[id] ?? [];
}

// ── Turning a catalogue entry into a plan ──────────────────────────────────

/**
 * Equipment most people can actually reach, in rough order of availability.
 *
 * A generated session defaults to this because "suggest me a back workout"
 * should not open with a cable crossover for someone on a bedroom floor. The
 * full library stays browsable; only the *generator* is opinionated.
 */
export const HOME_EQUIPMENT: Equipment[] = ['body only', 'dumbbell', 'bands'];

/**
 * Categories a timed session should draw from.
 *
 * Olympic weightlifting and strongman are excluded not because they are bad but
 * because a snatch does not belong in an auto-generated 10-minute session for
 * somebody whose level we do not know. Stretching is excluded from the main
 * body for the same reason it is not a workout on its own.
 */
const SESSION_CATEGORIES: Category[] = ['strength', 'cardio', 'plyometrics'];

/**
 * Reps and hold times, derived from what the dataset does tell us.
 *
 * The dataset has no prescription — no sets, no reps, no rest. Rather than
 * invent a number per exercise (873 guesses nobody could check), these come
 * from two properties it does carry:
 *
 *   mechanic  compound movements move more load, so fewer reps
 *   force     a `static` exercise is a hold, not a rep count
 *
 * Bodyweight work gets more reps than loaded work at the same mechanic, since
 * the load cannot be raised.
 */
function prescribe(e: Exercise): { reps: number | null; holdSeconds?: number } {
  if (e.force === 'static') {
    return { reps: null, holdSeconds: e.level === 'beginner' ? 30 : 45 };
  }

  const bodyweight = e.equipment === 'body only' || e.equipment === undefined;
  if (e.category === 'cardio' || e.category === 'plyometrics') {
    return { reps: bodyweight ? 20 : 15 };
  }
  if (e.mechanic === 'compound') {
    return { reps: bodyweight ? 12 : 8 };
  }
  return { reps: bodyweight ? 15 : 12 };
}

/**
 * The one-line descriptor under an exercise name.
 *
 * Deliberately factual — equipment and mechanic — rather than a coaching cue.
 * Writing 873 form cues would mean inventing technique advice at scale for
 * movements that can hurt people if performed wrong. The real instructions are
 * one tap away on the detail screen, straight from the source.
 */
export function describe(e: Exercise): string {
  return [titleCase(equipmentOf(e)), titleCase(e.level)].join(' · ');
}

const WORK_SECONDS = 40;
const SETUP_SECONDS = 20;

/**
 * A stable, non-alphabetical tiebreak.
 *
 * Sorting ties by name gave every session an alphabetical bias — a generated
 * Legs workout opened with "Alternate Leg Diagonal Bound", "Balance Board",
 * "Bench Sprint", which reads as a bug because it is one. Hashing the id
 * scatters equally-ranked exercises while keeping the order deterministic.
 */
const idHash = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    // Modulo rather than a bitwise fold: same scattering, no overflow, and it
    // reads as arithmetic instead of as a trick.
    h = (h * 31 + id.charCodeAt(i)) % 100000;
  }
  return h;
};

/**
 * Orders a muscle's exercises so a generated session is coherent.
 *
 * The weights are ordered by how much each property affects whether the
 * session is the right one to hand somebody who just tapped "Legs":
 *
 *   category   strength is what people mean by a workout; plyometrics are
 *              explosive work that belongs in a session someone chose
 *   mechanic   compound movements demand most and belong while you are fresh
 *   level      beginner first, because the generator does not know who asked
 *   equipment  bodyweight last, as a nudge rather than a rule
 *
 * Level outranks equipment deliberately. Weighted the other way, Shoulders
 * opened with Handstand Push-Ups — bodyweight, so it won — which is not a
 * movement to hand somebody whose ability we have never seen. A beginner
 * dumbbell press is the better suggestion even though it needs a dumbbell.
 */
const sessionRank = (e: Exercise): number => {
  const category = e.category === 'strength' ? 0 : e.category === 'cardio' ? 1 : 2;
  const compound = e.mechanic === 'compound' ? 0 : 1;
  const level = { beginner: 0, intermediate: 1, expert: 2 }[e.level];
  const bodyweight = equipmentOf(e) === 'body only' ? 0 : 1;
  return category * 1000 + compound * 400 + level * 100 + bodyweight * 50;
};

export type GeneratedSession = {
  plan: WorkoutPlan;
  /** What the generator drew from, so the UI can be honest about it. */
  pool: Exercise[];
};

/**
 * Builds a time-fitted session for a body region from the real library.
 *
 * The fit maths matches `training.buildPlan` exactly — each set costs work +
 * rest and each exercise adds a setup cost — so a generated session makes the
 * same promise the rest of the app makes about the clock.
 */
export function generateSession(
  region: BodyRegion,
  minutes: number,
  options: { equipment?: Equipment[]; level?: Level; seed?: number } = {},
): GeneratedSession {
  const equipment = options.equipment ?? HOME_EQUIPMENT;

  let pool = findExercises({ region, equipment, category: SESSION_CATEGORIES });

  // Someone with a full gym selected may still filter down to nothing for a
  // small region. Widening beats returning an empty session.
  if (pool.length < 3) {
    pool = findExercises({ region, category: SESSION_CATEGORIES });
  }
  if (options.level) {
    const byLevel = pool.filter(e => e.level === options.level);
    if (byLevel.length >= 3) {
      pool = byLevel;
    }
  }

  const ordered = [...pool].sort((a, b) => {
    const r = sessionRank(a) - sessionRank(b);
    return r !== 0 ? r : idHash(a.id) - idHash(b.id);
  });

  /*
   * A stable rotation, so "another one" gives a different session while the
   * same request twice running does not.
   *
   * The stride is a quarter of the pool rather than one: rotating by a single
   * place shares three of four exercises with the previous session, which does
   * not read as a new suggestion. Quartering means each tap moves to a
   * genuinely different part of the ranking and four taps return to the top.
   */
  const seed = options.seed ?? 0;
  const stride = Math.max(1, Math.floor(ordered.length / 4));
  const offset = ordered.length > 0 ? (seed * stride) % ordered.length : 0;
  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];

  const budget = minutes * 60;
  const rest = minutes <= 8 ? 20 : minutes <= 15 ? 30 : 40;
  const perSet = WORK_SECONDS + rest;

  let sets = 3;
  let count = 0;
  while (sets >= 1) {
    count = Math.floor(budget / (sets * perSet + SETUP_SECONDS));
    if (count >= 3) {
      break;
    }
    sets -= 1;
  }
  count = Math.min(Math.max(count, 2), rotated.length);

  const chosen = rotated.slice(0, count);

  const exercises: ExercisePlan[] = chosen.map(e => ({
    id: e.id,
    name: e.name,
    cue: describe(e),
    sets,
    restSeconds: rest,
    ...prescribe(e),
  }));

  return {
    pool: rotated,
    plan: {
      id: `${region}-${minutes}-${seed}`,
      title: `${minutes}-minute ${REGION_LABEL[region]}`,
      // The logging screen and history key off `Focus`; a region maps onto it.
      focus: REGION_FOCUS[region],
      minutes,
      exercises,
    },
  };
}

/**
 * Regions map onto the existing five foci.
 *
 * History, streaks and the calendar all key off `Focus`, and inventing a
 * parallel taxonomy would mean a session logged from the library did not show
 * up the same way as one logged from the old flow.
 */
export const REGION_FOCUS: Record<BodyRegion, Focus> = {
  chest: 'upper',
  back: 'upper',
  arms: 'upper',
  shoulders: 'upper',
  core: 'core',
  legs: 'legs',
};

/**
 * What a screen needs to rebuild a plan from route params.
 *
 * `WorkoutDetail` and `WorkoutLog` are separate screens that must show the
 * SAME session — the second is the first one being performed. Both rebuild it
 * from params rather than passing an object through navigation, so this
 * resolver is the single place that decides how, and `generateSession` is pure
 * in (region, minutes, seed) precisely so the two agree.
 */
export type PlanRequest = {
  minutes: number;
  focus: Focus;
  /** Present when the session came from the exercise library. */
  region?: BodyRegion;
  seed?: number;
};

export function resolvePlan(request: PlanRequest): WorkoutPlan {
  return request.region
    ? generateSession(request.region, request.minutes, { seed: request.seed }).plan
    : buildPlan(request.minutes, request.focus);
}
