/**
 * Char's notification voice.
 *
 * Char is warm and never guilt-trips. That is a product rule, not a style
 * preference: the whole premise is that people already feel bad about not
 * training, and an app that adds to that gets uninstalled.
 *
 * ── The rules ─────────────────────────────────────────────────────────────
 *  1. Never shame. No "you missed", "don't break", "you're falling behind",
 *     no countdown pressure, no red-alert language.
 *  2. Never imply loss is the user's fault. Char dims; the user is not blamed.
 *  3. Offer the smallest next step, not a demand. "A few minutes" beats
 *     "complete your workout".
 *  4. Be specific. Reference the real streak number or the real time budget,
 *     never a generic "time to work out!".
 *  5. Char may speak about itself, lightly. It is an ember, not a coach with
 *     a whistle.
 *  6. Short enough to read on a lock screen: title under ~40 chars.
 *
 * Copy lives here rather than in the Cloud Function so the voice has ONE home
 * and the function stays about scheduling. `functions/src/copy.ts` mirrors this
 * file — keep them in step.
 */

export type NudgeKind =
  | 'streak_at_risk'
  | 'streak_milestone'
  | 'comeback'
  | 'first_session'
  | 'weekly_recap';

export type Nudge = { title: string; body: string };

/** Deterministic pick so the same day does not produce a different line twice. */
const pick = <T>(options: T[], seed: number): T =>
  options[Math.abs(seed) % options.length];

export function streakAtRiskNudge(streak: number, seed = 0): Nudge {
  // Warmth, and the smallest possible next step. No countdown, no threat.
  const bodies = [
    `Still warm from ${streak} days. A few minutes keeps it that way.`,
    `${streak} days behind you. Even five minutes counts tonight.`,
    `I'm still glowing. Whenever you have a moment, I'll be here.`,
  ];
  return {
    title: 'Char is still lit',
    body: pick(bodies, seed),
  };
}

export function milestoneNudge(streak: number, stageName: string): Nudge {
  return {
    title: `${streak} days — you reached ${stageName}`,
    body: `That is ${streak} days in a row. I am burning properly now.`,
  };
}

export function comebackNudge(daysAway: number, seed = 0): Nudge {
  // Explicitly NOT "you've been gone N days". No guilt for time away.
  const bodies = [
    'Good to see you. We can start small — five minutes is a real session.',
    'No catching up needed. Whatever you have today is enough to start again.',
    'I have been resting too. Ready when you are.',
  ];
  return {
    title: daysAway > 14 ? 'Still here' : 'Welcome back',
    body: pick(bodies, seed),
  };
}

export function firstSessionNudge(): Nudge {
  return {
    title: 'One session in',
    body: 'That is day one. Come back tomorrow and I stay lit.',
  };
}

export function weeklyRecapNudge(sessions: number, minutes: number): Nudge {
  return {
    title: `${sessions} sessions this week`,
    body: `${minutes} minutes of actual training. That is the whole point.`,
  };
}

export function nudgeFor(
  kind: NudgeKind,
  data: { streak?: number; stageName?: string; daysAway?: number; sessions?: number; minutes?: number },
  seed = 0,
): Nudge {
  switch (kind) {
    case 'streak_at_risk':
      return streakAtRiskNudge(data.streak ?? 1, seed);
    case 'streak_milestone':
      return milestoneNudge(data.streak ?? 1, data.stageName ?? 'a new stage');
    case 'comeback':
      return comebackNudge(data.daysAway ?? 1, seed);
    case 'first_session':
      return firstSessionNudge();
    case 'weekly_recap':
      return weeklyRecapNudge(data.sessions ?? 0, data.minutes ?? 0);
  }
}
