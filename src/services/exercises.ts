import {
  buildPlan,
  FOCUS_LABEL,
  type ExercisePlan,
  type Focus,
  type WorkoutPlan,
} from './training';

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
const sessionRank = (e: Exercise, equipmentOrder: Equipment[]): number => {
  const category = e.category === 'strength' ? 0 : e.category === 'cardio' ? 1 : 2;
  const compound = e.mechanic === 'compound' ? 0 : 1;
  const level = { beginner: 0, intermediate: 1, expert: 2 }[e.level];

  /*
   * Equipment preference is the ORDER of the caller's list, not a hardcoded
   * "bodyweight first".
   *
   * Hardcoded, answering "I train at a gym" changed almost nothing: bodyweight
   * always won and gym members were handed press-ups. Now the home kit leads
   * with bodyweight and the gym kit leads with barbells, so the answer
   * visibly does something. The weight keeps it below `level`, so it steers
   * rather than overrides — a beginner at a gym still gets beginner lifts.
   */
  const position = equipmentOrder.indexOf(equipmentOf(e));
  const equipment = position === -1 ? equipmentOrder.length : position;

  return category * 1000 + compound * 400 + level * 100 + equipment * 8;
};

export type GeneratedSession = {
  plan: WorkoutPlan;
  /** What the generator drew from, so the UI can be honest about it. */
  pool: Exercise[];
};

export type SessionOptions = {
  equipment?: Equipment[];
  /** Widening set, not a single level — see `levelsFor` in profile.ts. */
  levels?: Level[];
  categories?: Category[];
  seed?: number;
};

/** Candidate exercises for a set of muscles, honouring the profile filters. */
function poolFor(muscles: Muscle[], options: SessionOptions): Exercise[] {
  const equipment = options.equipment ?? HOME_EQUIPMENT;
  const categories = options.categories ?? SESSION_CATEGORIES;

  const matches = (e: Exercise) => hitsMuscles(e, muscles);

  let pool = EXERCISES.filter(
    e =>
      matches(e) &&
      categories.includes(e.category) &&
      equipment.includes(equipmentOf(e)),
  );

  // A narrow kit can filter a small region down to nothing. Widening beats an
  // empty session: a workout you cannot quite do as prescribed is more useful
  // than no workout at all.
  if (pool.length < 3) {
    pool = EXERCISES.filter(e => matches(e) && categories.includes(e.category));
  }

  if (options.levels?.length) {
    const byLevel = pool.filter(e => options.levels!.includes(e.level));
    if (byLevel.length >= 3) {
      pool = byLevel;
    }
  }

  return pool;
}

/**
 * Orders and fits a pool into a session that lands inside the budget.
 *
 * `spread` picks exercises with distinct primary muscles first. Without it a
 * "Full Body" session is whatever ranks highest overall, which in practice is
 * four chest movements — technically correct and obviously not full body.
 */
function fitSession(
  pool: Exercise[],
  minutes: number,
  title: string,
  focus: Focus,
  seed: number,
  equipmentOrder: Equipment[],
  spread = false,
): GeneratedSession {
  const ordered = [...pool].sort((a, b) => {
    const r = sessionRank(a, equipmentOrder) - sessionRank(b, equipmentOrder);
    return r !== 0 ? r : idHash(a.id) - idHash(b.id);
  });

  /*
   * A stable rotation, so "another one" gives a different session while the
   * same request twice running does not.
   *
   * The stride is a quarter of the pool rather than one: rotating by a single
   * place shares three of four exercises with the previous session, which does
   * not read as a new suggestion.
   */
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

  let chosen: Exercise[];
  if (spread) {
    const used = new Set<Muscle>();
    chosen = rotated.filter(e => {
      if (used.size >= count) {
        return false;
      }
      const muscle = e.primaryMuscles[0];
      if (muscle && used.has(muscle)) {
        return false;
      }
      used.add(muscle);
      return true;
    });
    // Distinct muscles may run out before the budget does.
    if (chosen.length < count) {
      chosen = [...chosen, ...rotated.filter(e => !chosen.includes(e))].slice(0, count);
    }
  } else {
    chosen = rotated.slice(0, count);
  }

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
    plan: { id: `${focus}-${minutes}-${seed}`, title, focus, minutes, exercises },
  };
}

/**
 * Builds a time-fitted session for a body region from the real library.
 *
 * The fit maths matches `training.buildPlan` exactly — each set costs work plus
 * rest and each exercise adds a setup cost — so a generated session makes the
 * same promise about the clock that the rest of the app makes.
 */
export function generateSession(
  region: BodyRegion,
  minutes: number,
  options: SessionOptions = {},
): GeneratedSession {
  return fitSession(
    poolFor(REGION_MUSCLES[region], options),
    minutes,
    `${minutes}-minute ${REGION_LABEL[region]}`,
    REGION_FOCUS[region],
    options.seed ?? 0,
    options.equipment ?? HOME_EQUIPMENT,
  );
}

/**
 * The muscles each of the five foci covers.
 *
 * `Focus` predates the library and is what history, streaks and the calendar
 * key off, so it stays — but the Train tab's sessions now come from the same
 * 873 exercises as everything else, which is what lets somebody who trains at
 * a gym get barbells there instead of press-ups.
 */
const FOCUS_MUSCLES: Record<Focus, Muscle[]> = {
  legs: REGION_MUSCLES.legs,
  upper: [
    ...REGION_MUSCLES.chest,
    ...REGION_MUSCLES.back,
    ...REGION_MUSCLES.arms,
    ...REGION_MUSCLES.shoulders,
  ],
  core: REGION_MUSCLES.core,
  full: ['chest', 'lats', 'quadriceps', 'abdominals', 'shoulders', 'hamstrings', 'glutes'],
  cardio: Object.values(REGION_MUSCLES).flat(),
};

/** Cardio means the category, not a muscle group. */
const FOCUS_CATEGORIES: Partial<Record<Focus, Category[]>> = {
  cardio: ['cardio', 'plyometrics'],
};

/** A session for one of the five foci, drawn from the library. */
export function generateFocusSession(
  focus: Focus,
  minutes: number,
  options: SessionOptions = {},
): GeneratedSession {
  const categories = FOCUS_CATEGORIES[focus] ?? options.categories;
  return fitSession(
    poolFor(FOCUS_MUSCLES[focus], { ...options, categories }),
    minutes,
    `${minutes}-minute ${FOCUS_LABEL[focus]}`,
    focus,
    options.seed ?? 0,
    options.equipment ?? HOME_EQUIPMENT,
    focus === 'full' || focus === 'cardio',
  );
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
  /** The exact exercises chosen upstream. Wins over re-deriving. */
  exerciseIds?: string[];
};

/**
 * Rebuilds a plan for the exact exercises given, fitted to the budget.
 *
 * Sets, reps and rest are derived the same way `generateSession` derives them,
 * so a plan rebuilt from ids matches the one that produced them.
 */
export function planFromIds(
  ids: string[],
  minutes: number,
  focus: Focus,
  region?: BodyRegion,
): WorkoutPlan {
  const chosen = ids.map(exerciseById).filter((e): e is Exercise => Boolean(e));
  const rest = minutes <= 8 ? 20 : minutes <= 15 ? 30 : 40;
  const perSet = WORK_SECONDS + rest;

  let sets = 3;
  while (sets > 1 && chosen.length * (sets * perSet + SETUP_SECONDS) > minutes * 60) {
    sets -= 1;
  }

  return {
    id: `${region ?? focus}-${minutes}-${ids.length}`,
    title: `${minutes}-minute ${region ? REGION_LABEL[region] : FOCUS_LABEL[focus]}`,
    focus,
    minutes,
    exercises: chosen.map(e => ({
      id: e.id,
      name: e.name,
      cue: describe(e),
      sets,
      restSeconds: rest,
      ...prescribe(e),
    })),
  };
}

/**
 * The single place that decides how route params become a plan.
 *
 * `WorkoutDetail` and `WorkoutLog` are separate screens that must show the SAME
 * session — the second is the first being performed.
 *
 * When the session came from the library, the chosen exercise IDS travel
 * through navigation rather than a region and a seed. Re-deriving would mean
 * both screens independently reading the user's profile and agreeing on it,
 * which is a race on first launch and a silent mismatch if the profile changes
 * between the preview and the set. Carrying the ids makes the session you
 * looked at literally the session you perform.
 */
export function resolvePlan(request: PlanRequest): WorkoutPlan {
  if (request.exerciseIds?.length) {
    return planFromIds(
      request.exerciseIds,
      request.minutes,
      request.focus,
      request.region,
    );
  }
  return request.region
    ? generateSession(request.region, request.minutes).plan
    : buildPlan(request.minutes, request.focus);
}
