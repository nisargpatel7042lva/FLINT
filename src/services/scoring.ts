import type { Effort, Group, Submission, TeamWar } from './types';

/**
 * Team Wars scoring.
 *
 * The model, as decided:
 *   1. UNIFIED POINTS  — every activity converts into one currency.
 *   2. CAPPED CONTRIBUTION — each member contributes at most `DAILY_MEMBER_CAP`
 *      points per day, so one hero cannot carry a team and grinding is bounded.
 *   3. DAILY ROUNDS — each calendar day is won separately; the war goes to the
 *      team that wins the most days.
 *   4. OPPONENT VERIFICATION — only verified (or auto-verified) submissions
 *      score. Pending ones are surfaced separately so the board stays honest
 *      without silently reversing later.
 *
 * ── Tuning knobs ──────────────────────────────────────────────────────────
 * The conversion rates and the cap were not specified, so these are proposals.
 * They are the only numbers that decide balance — change them here and every
 * screen follows.
 */
export const POINTS = {
  /** A completed strength/gym session. */
  perWorkout: 100,
  perKilometre: 10,
  per100Kcal: 20,
} as const;

/** Max points one member can contribute to their team in a single day. */
export const DAILY_MEMBER_CAP = 400;

/** Approvals needed from the opposing group before a submission scores. */
export const REQUIRED_APPROVALS = 2;

/** Converts raw effort into unified points, before any cap is applied. */
export function effortPoints(effort: Effort): number {
  return Math.round(
    effort.workouts * POINTS.perWorkout +
      effort.distanceKm * POINTS.perKilometre +
      (effort.kcal / 100) * POINTS.per100Kcal,
  );
}

/** Only these statuses contribute to the score. */
export function counts(s: Submission): boolean {
  return s.status === 'verified' || s.status === 'auto_verified';
}

export function isPending(s: Submission): boolean {
  return s.status === 'pending';
}

/**
 * A member's contribution for one day, after the cap.
 * Returns the raw total too, so the UI can show "capped" honestly.
 */
export function memberDayPoints(
  submissions: Submission[],
  memberId: string,
  day: string,
): { raw: number; capped: number; wasCapped: boolean } {
  const raw = submissions
    .filter(s => s.memberId === memberId && s.day === day && counts(s))
    .reduce((sum, s) => sum + effortPoints(s.effort), 0);

  const capped = Math.min(raw, DAILY_MEMBER_CAP);
  return { raw, capped, wasCapped: raw > DAILY_MEMBER_CAP };
}

/** Points a member has awaiting opponent approval on a given day. */
export function memberPendingPoints(
  submissions: Submission[],
  memberId: string,
  day: string,
): number {
  return submissions
    .filter(s => s.memberId === memberId && s.day === day && isPending(s))
    .reduce((sum, s) => sum + effortPoints(s.effort), 0);
}

/** A group's score for one day: the sum of its members' capped contributions. */
export function groupDayScore(
  group: Group,
  submissions: Submission[],
  day: string,
): number {
  return group.memberIds.reduce(
    (sum, memberId) => sum + memberDayPoints(submissions, memberId, day).capped,
    0,
  );
}

export function groupDayPending(
  group: Group,
  submissions: Submission[],
  day: string,
): number {
  return group.memberIds.reduce(
    (sum, memberId) => sum + memberPendingPoints(submissions, memberId, day),
    0,
  );
}

export type RoundResult = {
  day: string;
  scores: [number, number];
  /** Index of the winning group, or null for a tie / not yet decided. */
  winner: 0 | 1 | null;
};

/** Resolves one day of a war. */
export function resolveRound(
  war: TeamWar,
  groups: [Group, Group],
  submissions: Submission[],
  day: string,
): RoundResult {
  const a = groupDayScore(groups[0], submissions, day);
  const b = groupDayScore(groups[1], submissions, day);

  let winner: 0 | 1 | null = null;
  if (a > b) {
    winner = 0;
  } else if (b > a) {
    winner = 1;
  }

  return { day, scores: [a, b], winner };
}

export type WarStanding = {
  rounds: RoundResult[];
  /** Days won by each group. Ties count for neither. */
  daysWon: [number, number];
  /** Cumulative points, used only as the tiebreak. */
  totalPoints: [number, number];
  /** Live scores for `today`, including points still awaiting approval. */
  today: {
    day: string;
    scores: [number, number];
    pending: [number, number];
  };
  /** Leader by days won, falling back to total points. Null if dead level. */
  leader: 0 | 1 | null;
  /** Rounds not yet played. */
  daysRemaining: number;
};

/**
 * Full standing for a war.
 *
 * `today` is whichever day the caller considers current; rounds after it are
 * treated as unplayed so the UI can show a countdown rather than phantom ties.
 */
export function warStanding(
  war: TeamWar,
  groups: [Group, Group],
  submissions: Submission[],
  today: string,
): WarStanding {
  const played = war.days.filter(d => d < today);
  const rounds = played.map(d => resolveRound(war, groups, submissions, d));

  const daysWon: [number, number] = [0, 0];
  const totalPoints: [number, number] = [0, 0];

  for (const r of rounds) {
    if (r.winner !== null) {
      daysWon[r.winner] += 1;
    }
    totalPoints[0] += r.scores[0];
    totalPoints[1] += r.scores[1];
  }

  const todayRound = resolveRound(war, groups, submissions, today);
  totalPoints[0] += todayRound.scores[0];
  totalPoints[1] += todayRound.scores[1];

  let leader: 0 | 1 | null = null;
  if (daysWon[0] !== daysWon[1]) {
    leader = daysWon[0] > daysWon[1] ? 0 : 1;
  } else if (totalPoints[0] !== totalPoints[1]) {
    leader = totalPoints[0] > totalPoints[1] ? 0 : 1;
  }

  return {
    rounds,
    daysWon,
    totalPoints,
    today: {
      day: today,
      scores: todayRound.scores,
      pending: [
        groupDayPending(groups[0], submissions, today),
        groupDayPending(groups[1], submissions, today),
      ],
    },
    leader,
    daysRemaining: war.days.filter(d => d > today).length,
  };
}

/** Per-member breakdown for a group on a given day, ranked by contribution. */
export type MemberContribution = {
  memberId: string;
  points: number;
  raw: number;
  wasCapped: boolean;
  pending: number;
};

export function groupContributions(
  group: Group,
  submissions: Submission[],
  day: string,
): MemberContribution[] {
  return group.memberIds
    .map(memberId => {
      const { raw, capped, wasCapped } = memberDayPoints(submissions, memberId, day);
      return {
        memberId,
        points: capped,
        raw,
        wasCapped,
        pending: memberPendingPoints(submissions, memberId, day),
      };
    })
    .sort((x, y) => y.points - x.points);
}

/** "1 day" / "3 days" — avoids "1 days left" across the war screens. */
export function pluralDays(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}

/** True once enough opponents have approved. */
export function approvalReached(s: Submission): boolean {
  return s.approvals.length >= REQUIRED_APPROVALS;
}
