import AsyncStorage from '@react-native-async-storage/async-storage';

import { BARRIER_IDS, type BarrierId } from './onboarding';
import type { Category, Equipment, Level } from './exercises';

/**
 * Who the person is, and where they train.
 *
 * This exists to answer one question well — "which exercises should we even be
 * offering you?" — and one question honestly: how many calories that was.
 *
 * Deliberately small. Every field here has to earn its place by changing
 * something the user can see, because each one is a question standing between
 * somebody and their first workout. Anything we cannot act on is not asked.
 */

export type TrainingPlace = 'home' | 'gym' | 'both';

/** Phrased as time served rather than as a self-assessment of ability. */
export type Experience = 'new' | 'some' | 'experienced';

/**
 * Only used to pick a BMR formula for calorie estimates.
 *
 * `unspecified` is a first-class answer, not a refusal to answer: the estimate
 * falls back to the average of the two formulas, which is a smaller error than
 * most people imagine and far smaller than the error in guessing effort.
 */
export type Sex = 'male' | 'female' | 'unspecified';

export type Units = 'metric' | 'imperial';

export type GoalId = 'lose' | 'build' | 'endurance' | 'healthy';

export type TrainingProfile = {
  place: TrainingPlace;
  experience: Experience;
  goal: GoalId;
  sex: Sex;
  units: Units;
  /**
   * Year of birth, NOT age.
   *
   * Storing age means it is wrong from the next birthday onward and nothing
   * ever corrects it — the same class of bug as storing a formatted date
   * instead of a date.
   */
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  /**
   * The obstacle named on the first screen.
   *
   * Stored because the whole opening asks somebody to admit something, and an
   * app that asks and then never refers to it again has taken an answer
   * without giving anything back. It is what Spark answers with once the first
   * set is done, and what the streak-at-risk copy leans on later.
   */
  barrier?: BarrierId;
  /** True once the person has been through setup, so we stop asking. */
  completed: boolean;
};

export const DEFAULT_PROFILE: TrainingProfile = {
  place: 'home',
  experience: 'new',
  goal: 'healthy',
  sex: 'unspecified',
  units: 'metric',
  completed: false,
};

const KEY = 'kasrat.profile.v1';

// ── Persistence ────────────────────────────────────────────────────────────

const isPlace = (v: unknown): v is TrainingPlace =>
  v === 'home' || v === 'gym' || v === 'both';
const isExperience = (v: unknown): v is Experience =>
  v === 'new' || v === 'some' || v === 'experienced';
const isSex = (v: unknown): v is Sex =>
  v === 'male' || v === 'female' || v === 'unspecified';
const isGoal = (v: unknown): v is GoalId =>
  v === 'lose' || v === 'build' || v === 'endurance' || v === 'healthy';
const isBarrier = (v: unknown): v is BarrierId =>
  BARRIER_IDS.includes(v as BarrierId);

/** Bounds that reject nonsense without rejecting real people. */
const inRange = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;

export async function loadProfile(): Promise<TrainingProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return DEFAULT_PROFILE;
    }
    const p = JSON.parse(raw) as Partial<TrainingProfile>;
    const thisYear = new Date().getFullYear();

    return {
      place: isPlace(p.place) ? p.place : DEFAULT_PROFILE.place,
      experience: isExperience(p.experience) ? p.experience : DEFAULT_PROFILE.experience,
      goal: isGoal(p.goal) ? p.goal : DEFAULT_PROFILE.goal,
      sex: isSex(p.sex) ? p.sex : DEFAULT_PROFILE.sex,
      units: p.units === 'imperial' ? 'imperial' : 'metric',
      birthYear: inRange(p.birthYear, thisYear - 100, thisYear - 10),
      heightCm: inRange(p.heightCm, 100, 250),
      weightKg: inRange(p.weightKg, 25, 300),
      barrier: isBarrier(p.barrier) ? p.barrier : undefined,
      completed: Boolean(p.completed),
    };
  } catch {
    // Storage unavailable or corrupt. Defaults let somebody train today.
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: TrainingProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Fire and forget: a failed write costs this answer, not the workout.
  }
}

export const resetProfile = () => AsyncStorage.removeItem(KEY).catch(() => {});

// ── What the answers actually do ───────────────────────────────────────────

export const PLACE_LABEL: Record<TrainingPlace, string> = {
  home: 'At home',
  gym: 'At a gym',
  both: 'Both',
};

/**
 * What each answer actually changes, said plainly on the card.
 *
 * People answer setup questions better when they can see the consequence, and
 * a question whose consequence you cannot state is a question worth deleting.
 * It lives here rather than on a screen because two screens ask it — the
 * opening flow and Settings — and they must not drift.
 */
export const PLACE_EFFECT: Record<TrainingPlace, string> = {
  home: 'Bodyweight, dumbbells and bands.',
  gym: 'Machines, barbells, cables — the full floor.',
  both: 'Everything, and you pick per session.',
};

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  new: 'New to this',
  some: 'Some experience',
  experienced: 'Experienced',
};

export const GOAL_LABEL: Record<GoalId, string> = {
  lose: 'Lose weight',
  build: 'Build muscle',
  endurance: 'Boost endurance',
  healthy: 'Stay healthy',
};

/**
 * Equipment at home.
 *
 * Bodyweight plus the two things people actually own. Kettlebells and exercise
 * balls are deliberately absent: someone who has them is better served
 * answering "both", and offering a kettlebell swing to somebody with an empty
 * living room is exactly the failure this question exists to prevent.
 */
const HOME_KIT: Equipment[] = ['body only', 'dumbbell', 'bands'];

/**
 * Equipment at a gym, most distinctive first.
 *
 * The ORDER matters: the generator ranks by position in this list, so leading
 * with barbells and machines is what makes answering "I train at a gym"
 * actually change the session. Bodyweight stays last but stays present — a
 * gym still has a floor, and some of the best movements need nothing.
 *
 * `other` is absent even here: it is where the source dataset files sleds,
 * tyres and Car Deadlift.
 */
const GYM_KIT: Equipment[] = [
  'barbell',
  'machine',
  'cable',
  'dumbbell',
  'kettlebells',
  'e-z curl bar',
  'medicine ball',
  'exercise ball',
  'bands',
  'body only',
];

/** The equipment filter a profile implies. This is the whole point of asking. */
export function equipmentFor(profile: TrainingProfile): Equipment[] {
  switch (profile.place) {
    case 'gym':
      return GYM_KIT;
    case 'both':
      return GYM_KIT;
    default:
      return HOME_KIT;
  }
}

/**
 * Difficulty levels a profile should be offered.
 *
 * Widening rather than switching: somebody with some experience should still
 * see beginner movements, because plenty of the best exercises are tagged
 * beginner and hiding them would leave a worse session, not a harder one.
 */
export function levelsFor(profile: TrainingProfile): Level[] {
  switch (profile.experience) {
    case 'experienced':
      return ['beginner', 'intermediate', 'expert'];
    case 'some':
      return ['beginner', 'intermediate'];
    default:
      return ['beginner'];
  }
}

/**
 * Exercise categories a goal should draw from.
 *
 * Strength is in every list — it is the base of all four goals — and the goal
 * decides what joins it rather than what replaces it.
 */
export function categoriesFor(profile: TrainingProfile): Category[] {
  switch (profile.goal) {
    case 'lose':
    case 'endurance':
      return ['strength', 'cardio', 'plyometrics'];
    case 'build':
      return ['strength', 'powerlifting'];
    default:
      return ['strength', 'cardio'];
  }
}

// ── Derived numbers ────────────────────────────────────────────────────────

export const ageFrom = (birthYear?: number): number | undefined =>
  birthYear ? new Date().getFullYear() - birthYear : undefined;

/**
 * Metabolic equivalents, used to turn minutes into calories.
 *
 * Standard published values for the activity types the app can log. A MET is
 * multiples of resting metabolic rate, which is why the formula needs body
 * mass: the same movement costs a heavier person more.
 */
const MET: Record<Category | 'run' | 'walk', number> = {
  strength: 5,
  powerlifting: 6,
  'olympic weightlifting': 6,
  strongman: 6,
  plyometrics: 8,
  cardio: 7.5,
  stretching: 2.5,
  run: 9.8,
  walk: 3.5,
};

/**
 * Calories for a session.
 *
 * `kcal = MET × 3.5 × kg / 200 × minutes` — the standard estimate.
 *
 * Without a weight there is nothing to scale by, so it falls back to the flat
 * per-minute figure the app used before. That fallback is a real guess and is
 * labelled as one in the UI; asking for weight is what turns it into an
 * estimate.
 */
export function kcalFor(
  profile: TrainingProfile,
  minutes: number,
  activity: keyof typeof MET = 'strength',
): number {
  const met = MET[activity] ?? MET.strength;
  if (!profile.weightKg) {
    return Math.round(minutes * 8);
  }
  return Math.round(((met * 3.5 * profile.weightKg) / 200) * minutes);
}

/** True when we know enough to give a real calorie number rather than a guess. */
export const canEstimateCalories = (p: TrainingProfile): boolean => Boolean(p.weightKg);

// ── Unit display ───────────────────────────────────────────────────────────

export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalInches = Math.round(cm / 2.54);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
};

export const feetInchesToCm = (feet: number, inches: number): number =>
  Math.round((feet * 12 + inches) * 2.54);

export const kgToLb = (kg: number): number => Math.round(kg * 2.20462);
export const lbToKg = (lb: number): number => Math.round(lb / 2.20462);

export function formatHeight(cm: number | undefined, units: Units): string {
  if (!cm) {
    return '—';
  }
  if (units === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${cm} cm`;
}

export function formatWeight(kg: number | undefined, units: Units): string {
  if (!kg) {
    return '—';
  }
  return units === 'imperial' ? `${kgToLb(kg)} lb` : `${kg} kg`;
}
