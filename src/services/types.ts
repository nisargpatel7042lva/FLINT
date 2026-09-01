/** Domain model for groups, challenges, proof and the social feed. */

export type ActivityKind = 'workout' | 'run' | 'ride' | 'walk';

/** Raw effort for one logged session, before conversion to points. */
export type Effort = {
  workouts: number;
  distanceKm: number;
  kcal: number;
};

/**
 * Proof lifecycle.
 *
 * Individual/daily logging auto-verifies from GPS + timestamp.
 * Team Wars submissions require a video and are approved by the OPPOSING group,
 * so they sit in `pending` until enough approvals land.
 */
export type ProofStatus = 'auto_verified' | 'pending' | 'verified' | 'rejected';

export type ReactionKey = 'fire' | 'strong' | 'clap' | 'eyes';

export type Submission = {
  id: string;
  memberId: string;
  groupId: string;
  /** Set when the submission counts toward a Team War. */
  warId?: string;
  /** Calendar day the effort belongs to, `YYYY-MM-DD`. Rounds are per day. */
  day: string;
  kind: ActivityKind;
  effort: Effort;
  status: ProofStatus;
  /** Member ids from the opposing group who approved / rejected. */
  approvals: string[];
  rejections: string[];
  /** Local video URI for Team Wars proof. Upload is stubbed. */
  mediaUri?: string;
  /** Placeholder auto-verification signals for individual logging. */
  autoChecks?: { gpsOk: boolean; timestampOk: boolean };
  note?: string;
  createdAt: string;
  reactions: Record<ReactionKey, number>;
};

export type Member = {
  id: string;
  name: string;
  handle: string;
};

export type Group = {
  id: string;
  name: string;
  /** Short join code used by the "join a group" flow. */
  code: string;
  /**
   * Who created it.
   *
   * Needed the moment groups became shared rather than device-local: somebody
   * has to be allowed to remove a member, and "whoever opens the screen" is not
   * an answer. It is also what the security rules key the manage permission
   * off, so it is part of the model rather than a UI convenience.
   */
  ownerUid: string;
  /**
   * Account uids of everyone in the group.
   *
   * Named `memberIds` rather than `memberUids` because the fixture cast uses
   * the same field, and the demo screens should not need to know whether the
   * person behind an id is a real account or a seeded one.
   */
  memberIds: string[];
  createdAt: string;
};

export type ChallengeType = 'individual' | 'team_war';

/** e.g. "complete 5 workouts this week" */
export type IndividualChallenge = {
  id: string;
  type: 'individual';
  title: string;
  groupId: string;
  targetWorkouts: number;
  startDay: string;
  endDay: string;
};

export type TeamWar = {
  id: string;
  type: 'team_war';
  title: string;
  groupIds: [string, string];
  /** Inclusive calendar days that make up the rounds. */
  days: string[];
  createdAt: string;
};

export type Challenge = IndividualChallenge | TeamWar;

export type NotificationKind =
  | 'friend_completed'
  | 'team_losing'
  | 'team_winning'
  | 'streak_reminder'
  | 'proof_pending'
  | 'proof_verified'
  /** Person-to-person: someone nudged you, or called you out. */
  | 'nudge'
  | 'challenge';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Optional member whose avatar leads the row. */
  memberId?: string;
};
