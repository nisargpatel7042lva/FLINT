import type { Prediction, Verdict } from './predictions';

/**
 * The provocation layer's words.
 *
 * Two voices. `warm` is the default, and it is what every new member hears —
 * still a challenge, never a jab. `savage` is opt-in, for the people who
 * asked to be told they will not do it.
 *
 * The rules both voices follow, enforced by tests:
 *
 *   - Aim at effort and commitment, never at the person. Pace, distance,
 *     showing up — fair game. Bodies, weight and looks are not, in either
 *     voice, ever. That is where provocation stops being a dare and turns into
 *     the kind of thing that feeds an eating disorder.
 *   - Every jab comes with the way to answer it. A provocation with no next
 *     step is just an insult.
 *   - When the person wins, say so plainly. "We were wrong" is the payoff the
 *     whole mechanic exists for, and an app that cannot admit it loses the
 *     right to make the next call.
 */

export type Tone = 'warm' | 'savage';

export const TONES: Tone[] = ['warm', 'savage'];

const kmText = (km: number) =>
  `${Number.isInteger(km) ? km : km.toFixed(1).replace(/\.0$/, '')} km`;

const marginText = (km: number) =>
  km < 0.1 ? 'a whisker' : km < 1 ? `${Math.round(km * 1000)} m` : kmText(Math.round(km * 10) / 10);

/** The call, made before the run starts. */
export function predictionLine(p: Prediction, tone: Tone): string {
  const target = kmText(p.targetKm);
  const what = p.kind === 'walk' ? 'walk' : 'run';

  if (p.basis === 'first') {
    return tone === 'savage'
      ? `First ${what}. We're betting you stop before ${target}.`
      : `First ${what}. Our guess is you stop before ${target} — show us otherwise.`;
  }
  return tone === 'savage'
    ? `Your last ${p.sample} ${what}s say you stop before ${target}. Prove us wrong.`
    : `Your last ${p.sample} ${what}s put your limit around ${target} today. Go past it.`;
}

/** The answer, after the run. */
export function verdictLine(v: Verdict, tone: Tone): string {
  if (v.beaten) {
    return tone === 'savage'
      ? `We were wrong. Noted. ${
          v.marginKm >= 0.1 ? `${marginText(v.marginKm)} past our call. ` : ''
        }The next one goes up.`
      : `You beat our call by ${marginText(v.marginKm)}. We'll aim higher next time.`;
  }
  return tone === 'savage'
    ? `Called it. ${marginText(v.marginKm)} short. Rematch tomorrow?`
    : `${marginText(v.marginKm)} short of our call. It'll be there tomorrow.`;
}

/** When somebody overtakes you on a club board. */
export function passedLine(passer: string, club: string, tone: Tone): string {
  return tone === 'savage'
    ? `${passer} just ran past you on ${club}. If I were you, I'd challenge them and take it back today.`
    : `${passer} passed you on the ${club} board. One run gets it back.`;
}

/** Words neither voice is ever allowed to use. Checked by tests. */
export const NEVER_SAY = [
  'fat',
  'weight',
  'kg',
  'body',
  'ugly',
  'lazy',
  'pathetic',
  'loser',
  'worthless',
  'disgusting',
];
