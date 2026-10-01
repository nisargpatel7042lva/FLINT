import type { RunKind, RunRecord } from './runs';

/**
 * "Prove us wrong."
 *
 * Before a run the app makes a call against the runner: you will stop before
 * this distance. The call comes from their own recent runs, which is what makes
 * it land — it is not an insult, it is their average said out loud.
 *
 * The target is pitched to be beaten. A call people lose every time is a call
 * they stop reading, and then it is just an app being rude. So the bar sits a
 * little past their typical run: beating it takes a real effort, not a
 * miracle, and when they do the app says it was wrong.
 */

export type Prediction = {
  kind: RunKind;
  /** "You stop before this." Always a multiple of 0.5 km. */
  targetKm: number;
  /** `history` when there are enough runs to judge; `first` otherwise. */
  basis: 'history' | 'first';
  /** How many runs the call was made from. */
  sample: number;
};

export type Verdict = {
  beaten: boolean;
  /** Distance over the target when beaten, under it when not. Always ≥ 0. */
  marginKm: number;
};

/** Runs considered. Recent enough to reflect current form. */
const WINDOW = 6;
/** Below this the median is noise, so the first-runs bet is used instead. */
const MIN_HISTORY = 3;
/** How far past the typical run the bar sits. */
const STRETCH = 1.05;
/** The bet for somebody with no history. Short enough to be very beatable. */
const FIRST_RUN_KM = 2;

const ceilToHalf = (km: number) => Math.ceil(km * 2) / 2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The call for the next run of `kind`.
 *
 * Median rather than mean, so one unusually long Sunday run does not set a bar
 * the runner cannot reach on a Tuesday — the call has to be about their normal,
 * not their best.
 */
export function predict(runs: RunRecord[], kind: RunKind): Prediction {
  const recent = runs
    .filter(r => r.kind === kind && r.distanceKm > 0)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, WINDOW);

  if (recent.length < MIN_HISTORY) {
    return { kind, targetKm: FIRST_RUN_KM, basis: 'first', sample: recent.length };
  }

  const typical = median(recent.map(r => r.distanceKm));
  return {
    kind,
    targetKm: Math.max(1, ceilToHalf(typical * STRETCH)),
    basis: 'history',
    sample: recent.length,
  };
}

export function judge(prediction: Prediction, distanceKm: number): Verdict {
  const beaten = distanceKm >= prediction.targetKm;
  return {
    beaten,
    marginKm: Math.round(Math.abs(distanceKm - prediction.targetKm) * 100) / 100,
  };
}
