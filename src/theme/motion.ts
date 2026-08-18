import { Easing } from 'react-native-reanimated';

/**
 * Micro-interaction guidelines.
 *
 * Every animation in the app pulls its timing and curve from this file. The
 * point is that motion should feel like one system: if a later phase needs a
 * new feel, add a named token here rather than inventing a bespoke duration at
 * the call site. Reviewing this file should tell you how the whole app moves.
 *
 * ── The rules ─────────────────────────────────────────────────────────────
 *
 * 1. TAPS get a subtle scale-pop, never a colour flash alone.
 *    `spring.press` in, `spring.settle` out, bottoming out at `scale.pressIn`.
 *    Fast enough to feel mechanical (~150ms), never bouncy.
 *
 * 2. COMPLETIONS get a spring, not a linear tween. Finishing a workout,
 *    hitting a milestone, a proof being verified — use `spring.pop` and let it
 *    overshoot slightly. This is the only place overshoot is welcome.
 *
 * 3. COUNTERS increment smoothly rather than snapping. A streak going 6 → 7
 *    animates over `counter.duration`; a score jumping hundreds of points ticks
 *    up rather than teleporting. Never longer than `counter.maxDuration`.
 *
 * 4. ENTRANCES decelerate (`easing.decelerate`); EXITS accelerate
 *    (`easing.accelerate`). Things arrive gently and leave briskly.
 *
 * 5. AMBIENT loops (Char breathing, live pulses) run on `duration.ambient` or
 *    slower, at low amplitude. They must never compete with content for
 *    attention or drain battery — transform and opacity only.
 *
 * 6. PROGRESS bars use `duration.slow` with `easing.standard`. Long enough to
 *    read as movement, short enough not to lag the number beside it.
 *
 * ── Performance ───────────────────────────────────────────────────────────
 * Animate `transform` and `opacity` only. Width/height/colour animations do not
 * run on the UI thread cheaply — the one deliberate exception is `RaceTrack`,
 * where the bar width IS the information being conveyed.
 */

export const duration = {
  /** Immediate feedback — press states. */
  instant: 90,
  /** Small state flips: chips, toggles, checkmarks. */
  fast: 150,
  /** Default for most UI transitions. */
  base: 220,
  /** Bars, sheets, anything travelling a visible distance. */
  slow: 320,
  /** Celebrations and screen-level moves. */
  deliberate: 480,
  /** One cycle of an ambient loop (breathing, glow). */
  ambient: 2400,
  /** A slower ambient cycle, for "quiet" states. */
  ambientSlow: 3600,
} as const;

export const easing = {
  /** The workhorse. Symmetric, neutral. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Entrances — fast out of the gate, gentle landing. */
  decelerate: Easing.bezier(0, 0, 0, 1),
  /** Exits — gentle start, quick departure. */
  accelerate: Easing.bezier(0.3, 0, 1, 1),
  /** Ambient loops. Sine in/out avoids a visible "stop" at each end. */
  breathe: Easing.inOut(Easing.sin),
  /** Attention without alarm — used by Char's concerned flicker. */
  flicker: Easing.inOut(Easing.quad),
} as const;

/**
 * Spring configs. Reanimated springs are defined by damping/stiffness/mass —
 * these three cover every case in the app.
 */
export const spring = {
  /** Press-in. Critically damped: responds instantly, no wobble. */
  press: { damping: 26, stiffness: 420, mass: 0.7 },
  /** Celebration pop. Deliberately under-damped so it overshoots once. */
  pop: { damping: 11, stiffness: 260, mass: 0.9 },
  /** Return-to-rest after a press, and general settling. */
  settle: { damping: 20, stiffness: 220, mass: 1 },
} as const;

/** Scale factors, so "how much does it pop" is decided once. */
export const scale = {
  /** Tap target compresses to this. */
  pressIn: 0.96,
  /** Celebration peak before settling back to 1. */
  pop: 1.08,
  /** Ambient breathing amplitude — deliberately tiny. */
  breathe: 1.05,
} as const;

/** Numeric counters (streaks, points). */
export const counter = {
  /** Target duration for a typical increment. */
  duration: 600,
  /** Hard ceiling — a huge jump must not crawl. */
  maxDuration: 900,
} as const;

export type Duration = keyof typeof duration;
export type SpringName = keyof typeof spring;
