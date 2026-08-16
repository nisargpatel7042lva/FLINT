import type {
  ActivityKind,
  AppNotification,
  Group,
  IndividualChallenge,
  Member,
  Submission,
  TeamWar,
} from './types';

/**
 * In-memory fixtures.
 *
 * Everything here is deterministic (seeded PRNG) so the scoreboard looks the
 * same on every reload and screenshots stay comparable. Replace wholesale when
 * the backend lands — screens only import the selectors at the bottom.
 */

/* eslint-disable no-bitwise -- mulberry32 is defined in terms of bit ops. */
/** Deterministic PRNG so fixtures never shuffle between reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

const toDay = (d: Date) => d.toISOString().slice(0, 10);

const shiftDays = (base: Date, delta: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
};

const NOW = new Date();
export const TODAY = toDay(NOW);

/** War runs from 5 days ago through tomorrow: 5 played, 1 live, 1 to come. */
export const WAR_DAYS = [-5, -4, -3, -2, -1, 0, 1].map(delta =>
  toDay(shiftDays(NOW, delta)),
);

export const CURRENT_USER_ID = 'm1';

export const MEMBERS: Member[] = [
  { id: 'm1', name: 'Nisarg', handle: '@nisarg' },
  { id: 'm2', name: 'Ava Cole', handle: '@avacole' },
  { id: 'm3', name: 'Ben Ortiz', handle: '@benortiz' },
  { id: 'm4', name: 'Cara Diaz', handle: '@caradiaz' },
  { id: 'm5', name: 'Dan Reed', handle: '@danreed' },
  { id: 'm6', name: 'Eve Shah', handle: '@eveshah' },
  { id: 'm7', name: 'Finn Wu', handle: '@finnwu' },
  { id: 'm8', name: 'Gia Lopez', handle: '@gialopez' },
  { id: 'm9', name: 'Hana Kim', handle: '@hanakim' },
  { id: 'm10', name: 'Ivan Petro', handle: '@ivanpetro' },
];

export const GROUPS: Group[] = [
  {
    id: 'g1',
    name: 'Iron Wolves',
    code: 'WOLF42',
    memberIds: ['m1', 'm2', 'm3', 'm4', 'm5'],
    createdAt: toDay(shiftDays(NOW, -40)),
  },
  {
    id: 'g2',
    name: 'Night Runners',
    code: 'NIGHT7',
    memberIds: ['m6', 'm7', 'm8', 'm9', 'm10'],
    createdAt: toDay(shiftDays(NOW, -32)),
  },
  {
    id: 'g3',
    name: 'Sunrise Crew',
    code: 'RISE11',
    memberIds: ['m1', 'm6', 'm8'],
    createdAt: toDay(shiftDays(NOW, -12)),
  },
];

export const WAR: TeamWar = {
  id: 'w1',
  type: 'team_war',
  title: 'Iron Wolves vs Night Runners',
  groupIds: ['g1', 'g2'],
  days: WAR_DAYS,
  createdAt: toDay(shiftDays(NOW, -6)),
};

export const INDIVIDUAL_CHALLENGES: IndividualChallenge[] = [
  {
    id: 'c1',
    type: 'individual',
    title: 'Complete 5 workouts this week',
    groupId: 'g1',
    targetWorkouts: 5,
    startDay: toDay(shiftDays(NOW, -3)),
    endDay: toDay(shiftDays(NOW, 3)),
  },
];

const KINDS: ActivityKind[] = ['workout', 'run', 'ride', 'walk'];

const NOTES = [
  'Leg day. Barely walked out.',
  'Easy 5k before work.',
  'Hill repeats — brutal.',
  'Pushed a new PR today.',
  'Recovery ride, felt good.',
  'Early session, empty gym.',
];

/** Builds the war's submission history. */
function buildSubmissions(): Submission[] {
  const rand = mulberry32(20260816);
  const out: Submission[] = [];
  let n = 0;

  const warGroups = GROUPS.slice(0, 2);

  for (const day of WAR_DAYS) {
    if (day > TODAY) {
      continue; // future rounds have no submissions yet
    }

    for (const group of warGroups) {
      const opponent = warGroups.find(g => g.id !== group.id)!;

      for (const memberId of group.memberIds) {
        // Not everyone trains every day.
        if (rand() < 0.25) {
          continue;
        }

        const kind = KINDS[Math.floor(rand() * KINDS.length)];
        const workouts = kind === 'workout' ? 1 : 0;
        const distanceKm =
          kind === 'run' ? 4 + rand() * 8 : kind === 'ride' ? 10 + rand() * 20 : kind === 'walk' ? 2 + rand() * 4 : 0;
        const kcal = 180 + rand() * 520;

        const isToday = day === TODAY;
        // Today's Team War submissions are still being approved by opponents.
        const stillPending = isToday && rand() < 0.45;

        const approvals = stillPending
          ? opponent.memberIds.slice(0, rand() < 0.5 ? 1 : 0)
          : opponent.memberIds.slice(0, 2);

        n += 1;
        out.push({
          id: `s${n}`,
          memberId,
          groupId: group.id,
          warId: WAR.id,
          day,
          kind,
          effort: {
            workouts,
            distanceKm: Math.round(distanceKm * 10) / 10,
            kcal: Math.round(kcal),
          },
          status: stillPending ? 'pending' : 'verified',
          approvals,
          rejections: [],
          mediaUri: `file://proof/${n}.mp4`,
          note: rand() < 0.4 ? NOTES[Math.floor(rand() * NOTES.length)] : undefined,
          createdAt: `${day}T${String(6 + Math.floor(rand() * 14)).padStart(2, '0')}:${String(
            Math.floor(rand() * 60),
          ).padStart(2, '0')}:00`,
          reactions: {
            fire: Math.floor(rand() * 7),
            strong: Math.floor(rand() * 4),
            clap: Math.floor(rand() * 5),
            eyes: Math.floor(rand() * 3),
          },
        });
      }
    }
  }

  return out;
}

export const SUBMISSIONS: Submission[] = buildSubmissions();

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'team_losing',
    title: 'Night Runners just took the lead',
    body: 'Your team is 240 pts down with 4 hours left in today’s round.',
    createdAt: `${TODAY}T18:12:00`,
    read: false,
  },
  {
    id: 'n2',
    kind: 'proof_pending',
    title: '3 submissions need your review',
    body: 'Night Runners are waiting on Iron Wolves to verify their proof.',
    createdAt: `${TODAY}T17:40:00`,
    read: false,
  },
  {
    id: 'n3',
    kind: 'friend_completed',
    title: 'Ava completed a challenge',
    body: 'Ava Cole finished “Complete 5 workouts this week”.',
    createdAt: `${TODAY}T14:05:00`,
    read: false,
    memberId: 'm2',
  },
  {
    id: 'n4',
    kind: 'streak_reminder',
    title: 'Keep your 6-day streak alive',
    body: 'Log something before midnight to hold the streak.',
    createdAt: `${TODAY}T09:00:00`,
    read: true,
  },
  {
    id: 'n5',
    kind: 'proof_verified',
    title: 'Your proof was verified',
    body: 'Finn Wu and Gia Lopez approved yesterday’s run. +180 pts counted.',
    createdAt: `${WAR_DAYS[4]}T20:15:00`,
    read: true,
    memberId: 'm7',
  },
];

// ── Selectors ──────────────────────────────────────────────────────────────

export const memberById = (id: string): Member =>
  MEMBERS.find(m => m.id === id) ?? { id, name: 'Unknown', handle: '@unknown' };

export const groupById = (id: string): Group =>
  GROUPS.find(g => g.id === id) ?? GROUPS[0];

export const warGroups = (): [Group, Group] => [
  groupById(WAR.groupIds[0]),
  groupById(WAR.groupIds[1]),
];

/** My groups, most recently created first. */
export const myGroups = (): Group[] =>
  GROUPS.filter(g => g.memberIds.includes(CURRENT_USER_ID));

/** Feed items newest first. */
export const feedSubmissions = (groupId?: string): Submission[] =>
  SUBMISSIONS.filter(s => (groupId ? s.groupId === groupId : true)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

/** Submissions from the opposing group awaiting my verification. */
export const pendingForReview = (): Submission[] =>
  SUBMISSIONS.filter(s => s.status === 'pending' && s.groupId !== 'g1');

export const unreadCount = (): number =>
  NOTIFICATIONS.filter(n => !n.read).length;
