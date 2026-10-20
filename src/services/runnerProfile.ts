import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where a runner is starting from, asked once in onboarding.
 *
 * Four questions, all multiple choice, none about the body. They exist to
 * make the app's numbers personal from day one instead of after three runs:
 * the weekly goal on Home, the first "prove us wrong" call, and the time of
 * day reminders are sent.
 */

export type RunFrequency = 'starting' | 'one-two' | 'three-four' | 'five-plus';
export type LongestRun = 'under-3' | '3-5' | '5-10' | '10-plus';
export type RunGoal = 'first-5k' | 'faster' | 'further' | 'consistent';
export type RunTime = 'morning' | 'evening' | 'whenever';

export type RunnerProfile = {
  frequency: RunFrequency;
  longest: LongestRun;
  goal: RunGoal;
  time: RunTime;
  /** Km per week the runner is aiming for. Derived, then theirs to change. */
  weeklyGoalKm: number;
  /** When they answered — growth is measured from here. */
  answeredAt: string;
};

export const FREQUENCY_OPTIONS: Array<{ value: RunFrequency; label: string }> = [
  { value: 'starting', label: 'Just starting' },
  { value: 'one-two', label: '1–2 runs a week' },
  { value: 'three-four', label: '3–4 runs a week' },
  { value: 'five-plus', label: '5 or more' },
];

export const LONGEST_OPTIONS: Array<{ value: LongestRun; label: string }> = [
  { value: 'under-3', label: 'Under 3 km' },
  { value: '3-5', label: '3–5 km' },
  { value: '5-10', label: '5–10 km' },
  { value: '10-plus', label: 'Over 10 km' },
];

export const GOAL_OPTIONS: Array<{ value: RunGoal; label: string; hint: string }> = [
  { value: 'first-5k', label: 'Run my first 5K', hint: 'Without stopping' },
  { value: 'faster', label: 'Get faster', hint: 'Knock time off my usual run' },
  { value: 'further', label: 'Run further', hint: '10K, then a half' },
  { value: 'consistent', label: 'Stop skipping runs', hint: 'Show up every week' },
];

export const RUN_TIME_OPTIONS: Array<{ value: RunTime; label: string }> = [
  { value: 'morning', label: 'Mornings' },
  { value: 'evening', label: 'Evenings' },
  { value: 'whenever', label: 'Whenever' },
];

/** Typical distance of one run, from the longest-run answer. */
export const typicalRunKm: Record<LongestRun, number> = {
  'under-3': 2,
  '3-5': 3.5,
  '5-10': 6,
  '10-plus': 10,
};

const runsPerWeek: Record<RunFrequency, number> = {
  starting: 2,
  'one-two': 2,
  'three-four': 3,
  'five-plus': 5,
};

/**
 * A weekly goal a little above where they are now — enough to be a stretch,
 * not so much that week one is a failure. Rounded to a whole km.
 */
export function suggestWeeklyGoal(
  p: Pick<RunnerProfile, 'frequency' | 'longest' | 'goal'>,
): number {
  const base = runsPerWeek[p.frequency] * typicalRunKm[p.longest];
  const stretch = p.goal === 'consistent' ? 1 : 1.1;
  return Math.max(5, Math.round(base * stretch));
}

const KEY = 'flint.runnerProfile.v1';

export async function loadRunnerProfile(): Promise<RunnerProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RunnerProfile) : null;
  } catch {
    return null;
  }
}

export async function saveRunnerProfile(p: RunnerProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
