import {
  ACTIVITY_KINDS,
  CODE_ALPHABET,
  LIMITS,
  clampNumber,
  generateGroupCode,
  generateInviteToken,
  hashesMatch,
  optionalText,
  randomCode,
  requireActivityKind,
  requireString,
} from '../functions/src/secure';
import { normaliseCode } from '../src/services/socialRepository';

/**
 * The Cloud Functions security helpers.
 *
 * These test properties rather than outputs, because that is the only way to
 * test randomness: you cannot assert what a token IS, only that the space it
 * comes from is large, uniform, and drawn from a source an attacker cannot
 * replay. The bug that prompted this file — `Math.random()` for invite tokens —
 * would pass any test that merely checked the shape of the string.
 */

describe('randomCode', () => {
  it('produces the requested length', () => {
    [1, 6, 16, 40].forEach(n => expect(randomCode(n)).toHaveLength(n));
  });

  it('only uses the shared alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      expect([...randomCode(16)].every(c => CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  /*
   * The alphabet excludes O/0, I/1, S/5 and B/8 precisely so a code survives
   * being read aloud. A server-minted code has to satisfy the same rule the
   * client normalises by, or the two disagree about what a valid code is.
   */
  it('mints codes the app will not mangle', () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generateGroupCode();
      expect(normaliseCode(code)).toBe(code);
    }
  });

  it('does not collide across a large sample', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => randomCode(16)));
    expect(seen.size).toBe(5000);
  });

  /*
   * Rejection sampling, not modulo.
   *
   * 256 does not divide by 24, so `byte % 24` would hand the first sixteen
   * characters of the alphabet a ~9% larger share than the rest. Over a long
   * sample every character should appear at roughly the same rate; a 25%
   * tolerance is loose enough never to flake and tight enough to catch the
   * modulo bias, which is far larger than that.
   */
  it('is not biased toward the start of the alphabet', () => {
    const counts = new Map<string, number>();
    const draws = 40_000;
    for (const c of randomCode(draws)) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    expect(counts.size).toBe(CODE_ALPHABET.length);
    const expected = draws / CODE_ALPHABET.length;
    counts.forEach(n => {
      expect(n).toBeGreaterThan(expected * 0.75);
      expect(n).toBeLessThan(expected * 1.25);
    });
  });
});

describe('generateInviteToken', () => {
  it('is long enough that guessing is not the attack', () => {
    // 16 characters over 24 symbols is ~73 bits.
    expect(generateInviteToken()).toHaveLength(16);
  });

  it('never repeats itself', () => {
    const seen = new Set(Array.from({ length: 2000 }, generateInviteToken));
    expect(seen.size).toBe(2000);
  });

  /*
   * A guard against the exact regression.
   *
   * `Math.random().toString(36).substring(2, 10)` yields base-36 output, so it
   * contains digits and letters outside this alphabet, and its length varies
   * with the float it came from. Both are visible from outside.
   */
  it('does not look like the Math.random token it replaced', () => {
    const tokens = Array.from({ length: 200 }, generateInviteToken);
    expect(tokens.every(t => t.length === 16)).toBe(true);
    expect(tokens.every(t => [...t].every(c => CODE_ALPHABET.includes(c)))).toBe(true);
  });
});

describe('hashesMatch', () => {
  it('matches a digest with itself', () => {
    const digest = 'a'.repeat(64);
    expect(hashesMatch(digest, digest)).toBe(true);
  });

  it('rejects a different digest', () => {
    expect(hashesMatch('a'.repeat(64), 'b'.repeat(64))).toBe(false);
  });

  it('rejects a length mismatch rather than throwing', () => {
    // timingSafeEqual throws on unequal lengths; the guard has to come first.
    expect(hashesMatch('ab', 'a'.repeat(64))).toBe(false);
  });
});

describe('clampNumber', () => {
  it('passes an ordinary value through', () => {
    expect(clampNumber(8.4, LIMITS.distanceKm, 'Distance')).toBe(8.4);
  });

  /*
   * Clamped, not rejected: the usual source of an absurd distance is a bad GPS
   * fix, and losing somebody's whole session over one reading is worse than
   * recording a capped one. The ceiling still has to exist, or a single write
   * owns the leaderboard forever.
   */
  it('caps an impossible distance instead of losing the session', () => {
    expect(clampNumber(1e9, LIMITS.distanceKm, 'Distance')).toBe(LIMITS.distanceKm);
  });

  it('treats a missing value as zero', () => {
    expect(clampNumber(undefined, LIMITS.kcal, 'Calories')).toBe(0);
    expect(clampNumber(null, LIMITS.kcal, 'Calories')).toBe(0);
  });

  it('refuses values that are not numbers at all', () => {
    [-1, NaN, Infinity, 'lots'].forEach(bad =>
      expect(() => clampNumber(bad, LIMITS.kcal, 'Calories')).toThrow(),
    );
  });
});

describe('requireString', () => {
  it('trims', () => {
    expect(requireString('  Morning Crew  ', 'Title')).toBe('Morning Crew');
  });

  it('refuses empty, whitespace-only and oversized input', () => {
    expect(() => requireString('', 'Title')).toThrow();
    expect(() => requireString('   ', 'Title')).toThrow();
    expect(() => requireString('x'.repeat(61), 'Title', { max: 60 })).toThrow();
  });

  it('refuses a non-string, which is what a hostile client sends', () => {
    [42, null, undefined, {}, []].forEach(bad =>
      expect(() => requireString(bad, 'Title')).toThrow(),
    );
  });
});

describe('optionalText', () => {
  it('is undefined for the empty cases', () => {
    [undefined, null, '', '   '].forEach(v =>
      expect(optionalText(v, LIMITS.noteChars)).toBeUndefined(),
    );
  });

  /* Truncated rather than rejected: a long note is clumsy, not malicious. */
  it('truncates rather than refusing', () => {
    expect(optionalText('x'.repeat(5000), LIMITS.noteChars)).toHaveLength(
      LIMITS.noteChars,
    );
  });
});

describe('requireActivityKind', () => {
  it('accepts every kind the app offers', () => {
    ACTIVITY_KINDS.forEach(k => expect(requireActivityKind(k)).toBe(k));
  });

  /*
   * This value is copied onto every submission the challenge produces, so an
   * unchecked one becomes a permanent, unfilterable entry in the other
   * person's history.
   */
  it('refuses anything else', () => {
    ['', 'RUN', 'sleeping', 42, null, undefined].forEach(bad =>
      expect(() => requireActivityKind(bad)).toThrow(),
    );
  });
});
