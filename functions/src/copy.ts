/**
 * Spark's notification voice — SERVER copy.
 *
 * Mirrors `src/services/notificationCopy.ts`. Kept as a separate file rather
 * than imported across the app/functions boundary (they have different build
 * setups), so the rule is: change one, change the other.
 *
 * ── The rules ─────────────────────────────────────────────────────────────
 *  1. Never shame. No "you missed", "don't break", no countdown pressure.
 *  2. Never blame the user for a lapse. Spark dims; nobody is at fault.
 *  3. Offer the smallest next step, not a demand.
 *  4. Be specific — real streak numbers, never "time to work out!".
 *  5. Spark may speak about itself, lightly.
 *  6. Title under ~40 chars so it survives a lock screen.
 */

export type Nudge = { title: string; body: string };

export type Tone = 'warm' | 'savage';

/**
 * "X passed you on the board."
 *
 * The body is word-for-word `passedLine` in `src/services/ego.ts` — the push and
 * the in-app banner are the same moment seen twice, and must say the same
 * thing. `__tests__/boardParity.test.ts` holds them together.
 */
export function passedNudge(passer: string, club: string, tone: Tone): Nudge {
  return {
    title: tone === 'savage' ? `${passer} took your spot` : 'Overtaken',
    body:
      tone === 'savage'
        ? `${passer} just took your spot on ${club}. Going to let that stand?`
        : `${passer} passed you on the ${club} board. One run gets it back.`,
  };
}

const pick = <T>(options: T[], seed: number): T =>
  options[Math.abs(seed) % options.length];

export function streakAtRiskNudge(streak: number, seed = 0): Nudge {
  const bodies = [
    `Still warm from ${streak} days. A few minutes keeps it that way.`,
    `${streak} days behind you. Even five minutes counts tonight.`,
    "I'm still glowing. Whenever you have a moment, I'll be here.",
  ];
  return { title: 'Your spark is still lit', body: pick(bodies, seed) };
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
