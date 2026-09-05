/** Domain model for groups, challenges, proof and the social feed. */

export type ActivityCategory = 'Cardio' | 'Strength' | 'Mobility' | 'Sports' | 'Outdoor';

export type ActivityKind =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'swim'
  | 'rowing'
  | 'elliptical'
  | 'stairmaster'
  | 'hiit'
  | 'jump_rope'
  | 'weights'
  | 'bodyweight'
  | 'crossfit'
  | 'powerlifting'
  | 'olympic_lifting'
  | 'yoga'
  | 'pilates'
  | 'stretching'
  | 'foam_rolling'
  | 'mobility_drills'
  | 'basketball'
  | 'soccer'
  | 'tennis'
  | 'volleyball'
  | 'boxing'
  | 'martial_arts'
  | 'climbing'
  | 'surfing'
  | 'skiing'
  | 'snowboarding'
  | 'hiking'
  | 'trail_running'
  | 'mountain_biking'
  | 'kayaking'
  | 'paddleboarding';

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  run: 'Run',
  walk: 'Walk',
  cycle: 'Cycle',
  swim: 'Swim',
  rowing: 'Rowing',
  elliptical: 'Elliptical',
  stairmaster: 'Stairmaster',
  hiit: 'HIIT',
  jump_rope: 'Jump Rope',
  weights: 'Weights',
  bodyweight: 'Bodyweight',
  crossfit: 'CrossFit',
  powerlifting: 'Powerlifting',
  olympic_lifting: 'Olympic Lifting',
  yoga: 'Yoga',
  pilates: 'Pilates',
  stretching: 'Stretching',
  foam_rolling: 'Foam Rolling',
  mobility_drills: 'Mobility Drills',
  basketball: 'Basketball',
  soccer: 'Soccer',
  tennis: 'Tennis',
  volleyball: 'Volleyball',
  boxing: 'Boxing',
  martial_arts: 'Martial Arts',
  climbing: 'Climbing',
  surfing: 'Surfing',
  skiing: 'Skiing',
  snowboarding: 'Snowboarding',
  hiking: 'Hiking',
  trail_running: 'Trail Running',
  mountain_biking: 'Mountain Biking',
  kayaking: 'Kayaking',
  paddleboarding: 'Paddleboarding',
};

export const ACTIVITY_BY_CATEGORY: Record<ActivityCategory, ActivityKind[]> = {
  Cardio: ['run', 'walk', 'cycle', 'swim', 'rowing', 'elliptical', 'stairmaster', 'hiit', 'jump_rope'],
  Strength: ['weights', 'bodyweight', 'crossfit', 'powerlifting', 'olympic_lifting'],
  Mobility: ['yoga', 'pilates', 'stretching', 'foam_rolling', 'mobility_drills'],
  Sports: ['basketball', 'soccer', 'tennis', 'volleyball', 'boxing', 'martial_arts'],
  Outdoor: ['climbing', 'surfing', 'skiing', 'snowboarding', 'hiking', 'trail_running', 'mountain_biking', 'kayaking', 'paddleboarding'],
};

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
  memberIds: string[];
  createdAt: string;
};

export type ChallengeType = 'individual' | 'team_war' | 'one_on_one';

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

/** 
 * 1:1 Challenge for the Flint MVP.
 * Two users compete with a shared activity goal and a challenge-scoped streak.
 */
export type OneOnOneChallenge = {
  id: string;
  type: 'one_on_one';
  /** Challenge name, e.g. "30-day Run Streak" */
  title: string;
  /** Unique invite token for accepting the challenge */
  inviteToken: string;
  /** The primary activity for this challenge (e.g. 'run') */
  activityKind: ActivityKind;
  /** Creator's user id */
  creatorId: string;
  /** Opponent's user id (set when accepted) */
  opponentId?: string;
  /** Group id (created when challenge is accepted) */
  groupId?: string;
  /** Target days of activity (e.g. 30) */
  targetDays: number;
  /** Target sessions per day (usually 1) */
  sessionsPerDay: number;
  /** Challenge status */
  status: 'pending' | 'active' | 'completed';
  /** When the challenge was created */
  createdAt: string;
  /** When the challenge was accepted (becomes active) */
  acceptedAt?: string;
  /** When the challenge was completed */
  completedAt?: string;
  /** Start day of the challenge (YYYY-MM-DD), set when accepted */
  startDay?: string;
  /** End day computed from startDay + targetDays */
  endDay?: string;
};

/** Challenge-scoped streak tracking (device-local + server-verified) */
export type ChallengeStreak = {
  /** Challenge id */
  challengeId: string;
  /** User id */
  userId: string;
  /** Current consecutive days with activity */
  currentStreak: number;
  /** Best streak achieved during this challenge */
  bestStreak: number;
  /** Last day with activity (YYYY-MM-DD) */
  lastActivityDay?: string;
  /** Total days with activity logged */
  totalActiveDays: number;
};

export type Challenge = IndividualChallenge | TeamWar | OneOnOneChallenge;

export type NotificationKind =
  | 'friend_completed'
  | 'team_losing'
  | 'team_winning'
  | 'streak_reminder'
  | 'proof_pending'
  | 'proof_verified';

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
