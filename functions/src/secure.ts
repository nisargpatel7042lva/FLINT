import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * The security primitives the callables share.
 *
 * Pulled into its own module for one reason: every function in here is the sort
 * that is quietly wrong for months. A predictable token still looks like a
 * token, an unclamped number still writes successfully, and neither shows up in
 * testing because the honest client never sends the bad input. Keeping them
 * together, named, and tested is what makes them reviewable.
 */

// ── Randomness ─────────────────────────────────────────────────────────────

/**
 * The alphabet for anything a person has to read aloud or type.
 *
 * No O/0, I/1, S/5 or B/8. Matches `CODE_ALPHABET` in the app so a code minted
 * by a Cloud Function survives the client's own normalisation — the app's
 * `normaliseCode` was already caught mangling a code that used characters it
 * did not expect.
 */
export const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349';

/**
 * A random string over `alphabet`, from the CSPRNG.
 *
 * `Math.random()` is not usable here and was, until this commit, how invite
 * tokens and group codes were minted. V8 implements it as xorshift128+: the
 * internal state is recoverable from a handful of outputs, so an attacker who
 * created one challenge of their own could predict the tokens minted for
 * everybody else on that instance and join their challenges.
 *
 * Rejection sampling rather than `% alphabet.length`, because the modulo maps
 * 256 byte values onto 24 characters unevenly and quietly biases the first
 * eight of them.
 */
export function randomCode(length: number, alphabet = CODE_ALPHABET): string {
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = '';
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (let i = 0; i < bytes.length && out.length < length; i += 1) {
      if (bytes[i] < max) {
        out += alphabet[bytes[i] % alphabet.length];
      }
    }
  }
  return out;
}

/**
 * An invite token.
 *
 * 16 characters over a 24-character alphabet is ~73 bits, which is past
 * brute-forcing even without the rate limit below. Length is the cheapest
 * security control there is and this one is never typed by hand — it travels
 * in a link.
 */
export const generateInviteToken = (): string => randomCode(16);

/** A group join code. Six characters, because this one IS read aloud. */
export const generateGroupCode = (): string => randomCode(6);

// ── Token hashing ──────────────────────────────────────────────────────────

/**
 * The pepper, read at call time rather than at module load.
 *
 * It used to `throw` at the top level if unset. That is the right instinct
 * applied in the wrong place: a module-level throw fails the whole deployment
 * package, so a missing pepper took down the streak reminders and the nudge
 * delivery too — functions that have nothing to do with invite codes. Failing
 * here means a misconfigured pepper breaks exactly the features that depend on
 * it, and says so.
 */
function pepper(): string {
  const value = process.env.JOIN_CODE_PEPPER;
  if (!value || value.length < 16) {
    throw new HttpsError(
      'failed-precondition',
      'Invite codes are unavailable: the server is missing its JOIN_CODE_PEPPER.',
    );
  }
  return value;
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(pepper() + token).digest('hex');
}

/**
 * Constant-time comparison of two hex digests.
 *
 * Firestore lookups compare the hash server-side, so this is belt and braces —
 * but any place that compares a secret with `===` is a place somebody later
 * copies into a loop that leaks timing.
 */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// ── Input validation ───────────────────────────────────────────────────────
//
// Everything a client sends is hostile until bounded. These are deliberately
// strict and deliberately boring: each one turns an unbounded value from the
// wire into something with a known ceiling, and throws rather than silently
// clamping when the input is not merely large but nonsensical.

/** Activity kinds a challenge may be built around. Mirrors `ActivityKind`. */
export const ACTIVITY_KINDS = [
  'run', 'walk', 'cycle', 'swim', 'rowing', 'elliptical', 'stairmaster',
  'hiit', 'jump_rope', 'weights', 'bodyweight', 'crossfit', 'powerlifting',
  'olympic_lifting', 'yoga', 'pilates', 'stretching', 'foam_rolling',
  'mobility_drills', 'basketball', 'soccer', 'tennis', 'volleyball', 'boxing',
  'martial_arts', 'climbing', 'surfing', 'skiing', 'snowboarding', 'hiking',
  'trail_running', 'mountain_biking', 'kayaking', 'paddleboarding',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export function requireActivityKind(value: unknown): ActivityKind {
  if (typeof value !== 'string' || !ACTIVITY_KINDS.includes(value as ActivityKind)) {
    throw new HttpsError('invalid-argument', 'Unknown activity.');
  }
  return value as ActivityKind;
}

/** A required string, trimmed and length-checked. */
export function requireString(
  value: unknown,
  field: string,
  { min = 1, max = 200 }: { min?: number; max?: number } = {},
): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpsError(
      'invalid-argument',
      `${field} must be between ${min} and ${max} characters.`,
    );
  }
  return trimmed;
}

/** An optional string. Truncated rather than rejected — see `note` below. */
export function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Expected text.');
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, max);
}

/**
 * A number inside plausible human limits.
 *
 * Clamped rather than rejected, because the caller is usually a GPS track with
 * a bad fix rather than an attacker, and losing somebody's whole session over
 * one impossible reading is the worse failure. The ceiling still has to exist:
 * without it a single write decides the leaderboard forever.
 */
export function clampNumber(value: unknown, max: number, field: string): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpsError('invalid-argument', `${field} must be a positive number.`);
  }
  return Math.min(n, max);
}

/** The ceilings. Generous enough for an ultramarathon, finite enough to bound. */
export const LIMITS = {
  /** A 24-hour ultra winner covers ~300km. */
  distanceKm: 500,
  /** Tour de France stage is ~6000 kcal. */
  kcal: 10_000,
  noteChars: 500,
  titleChars: 60,
  targetDaysMax: 365,
} as const;

// ── Abuse limits ───────────────────────────────────────────────────────────

/**
 * How many times one account may guess an invite token per window.
 *
 * The token space is large, so this is not what makes guessing infeasible —
 * length is. What the limit actually buys is a bound on cost: without it, an
 * attacker's guesses are free to them and are billed, one Firestore query each,
 * to whoever owns the project.
 */
export const TOKEN_ATTEMPT_LIMIT = 20;
export const TOKEN_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
