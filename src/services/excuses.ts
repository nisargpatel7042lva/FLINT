import type { Tone } from './ego';

/**
 * The excuse tax.
 *
 * Skipping a challenge day is allowed — it just isn't free. To skip, you pick
 * why, and the person you are up against sees it. Almost nobody wants a rival
 * to read "couldn't be bothered" next to their name, so the cheapest way out of
 * paying the tax is to go and run.
 *
 * What keeps this from becoming cruel:
 *
 *   - Rest and injury are real answers, and they are shown neutrally. A
 *     planned rest day is training, and an app that leans on somebody to run
 *     through an injury to protect their ego is an app that gets them hurt.
 *   - The sting is reserved for the one reason that deserves it, and the
 *     person chose it themselves.
 *   - Create-only. Once picked, it cannot be quietly edited into something
 *     more flattering after the rival has seen it.
 */

export type ExcuseReason = 'rest' | 'injured' | 'busy' | 'weather' | 'motivation';

export const EXCUSE_REASONS: ExcuseReason[] = [
  'rest',
  'injured',
  'busy',
  'weather',
  'motivation',
];

export type Excuse = {
  /** `${uid}_${day}` — one excuse per person per day. */
  id: string;
  uid: string;
  day: string;
  reason: ExcuseReason;
  createdAt: string;
};

/** What the person picking it reads. Honest labels; the last one is meant to sting. */
export const EXCUSE_LABEL: Record<ExcuseReason, string> = {
  rest: 'Planned rest day',
  injured: 'Injured or sore',
  busy: 'Ran out of time',
  weather: 'Weather',
  motivation: "Couldn't be bothered",
};

/** Rest and injury never get a jab, in either voice. */
export const isProtectedReason = (r: ExcuseReason): boolean =>
  r === 'rest' || r === 'injured';

export const excuseId = (uid: string, day: string): string => `${uid}_${day}`;

/** What the RIVAL reads about the person who skipped. */
export function excuseLine(name: string, reason: ExcuseReason, tone: Tone): string {
  if (reason === 'rest') {
    return `${name} is resting today. Recovery counts.`;
  }
  if (reason === 'injured') {
    return `${name} is sitting today out with an injury.`;
  }
  if (tone === 'savage') {
    switch (reason) {
      case 'busy':
        return `${name} skipped today. Reason: "ran out of time". Your move.`;
      case 'weather':
        return `${name} skipped today because of the weather. You don't have to.`;
      default:
        return `${name} skipped today. Their words: "couldn't be bothered". Open goal.`;
    }
  }
  switch (reason) {
    case 'busy':
      return `${name} ran out of time today. A good day to pull ahead.`;
    case 'weather':
      return `${name} skipped today for the weather.`;
    default:
      return `${name} skipped today — they couldn't be bothered. A chance to pull ahead.`;
  }
}

/**
 * The line under the skip button, said to the person about to skip.
 *
 * It tells them plainly what the rival will see. The tax only works if it is
 * paid knowingly; a surprise reveal afterwards would just feel like a trap.
 */
export const excuseWarning = 'Your rival will see the reason you pick.';
