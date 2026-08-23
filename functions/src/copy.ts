/**
 * Char's notification voice — SERVER copy.
 *
 * Mirrors `src/services/notificationCopy.ts`. Kept as a separate file rather
 * than imported across the app/functions boundary (they have different build
 * setups), so the rule is: change one, change the other.
 *
 * ── The rules ─────────────────────────────────────────────────────────────
 *  1. Never shame. No "you missed", "don't break", no countdown pressure.
 *  2. Never blame the user for a lapse. Char dims; nobody is at fault.
 *  3. Offer the smallest next step, not a demand.
 *  4. Be specific — real streak numbers, never "time to work out!".
 *  5. Char may speak about itself, lightly.
 *  6. Title under ~40 chars so it survives a lock screen.
 */

export type Nudge = { title: string; body: string };

const pick = <T>(options: T[], seed: number): T =>
  options[Math.abs(seed) % options.length];

export function streakAtRiskNudge(streak: number, seed = 0): Nudge {
  const bodies = [
    `Still warm from ${streak} days. A few minutes keeps it that way.`,
    `${streak} days behind you. Even five minutes counts tonight.`,
    "I'm still glowing. Whenever you have a moment, I'll be here.",
  ];
  return { title: 'Char is still lit', body: pick(bodies, seed) };
}

export function comebackNudge(daysAway: number, seed = 0): Nudge {
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

export function milestoneNudge(streak: number, stageName: string): Nudge {
  return {
    title: `${streak} days — you reached ${stageName}`,
    body: `That is ${streak} days in a row. I am burning properly now.`,
  };
}
